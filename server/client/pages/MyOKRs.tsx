
import React, { useState, useEffect } from 'react';
import { getOKRSuggestions } from '../services/geminiService';
import { Objective, KeyResult, ObjectiveStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import * as myOkrService from '../services/myOkrService';

export const MyOKRs: React.FC = () => {
  const { user, selectedPeriod } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editingOKRId, setEditingOKRId] = useState<string | null>(null);
  const [newObjective, setNewObjective] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [okrs, setOkrs] = useState<Objective[]>([]);
  const [pendingKRs, setPendingKRs] = useState<any[]>([]);
  const [manualKR, setManualKR] = useState({ title: '', targetValue: 0, unit: '' });

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const adaptOKR = (okr: any) => ({
    ...okr,
    id: okr._id || okr.id,
    keyResults: (okr.keyResults || []).map((kr: any) => ({ ...kr, id: kr._id || kr.id }))
  });

  const loadOKRs = async () => {
    setIsLoading(true);
    try {
      const data = await myOkrService.getMyOKRs({ quarter: selectedPeriod.quarter, year: selectedPeriod.year });
      setOkrs((data || []).map((o: any) => adaptOKR(o)));
    } catch (err) {
      // fallback to local storage
      const data = await dataService.getOKRs();
      setOkrs((data || []).map((o: any) => adaptOKR(o)));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadOKRs(); }, [selectedPeriod]);

  useEffect(() => {
    const handleOKRUpdate = () => loadOKRs();
    window.addEventListener('okrUpdated', handleOKRUpdate);
    return () => window.removeEventListener('okrUpdated', handleOKRUpdate);
  }, []);

  const handleGenerateKRs = async () => {
    if (!newObjective) return;
    setIsGenerating(true);
    const suggestions = await getOKRSuggestions(newObjective);
    if (suggestions && Array.isArray(suggestions)) {
      setPendingKRs([...pendingKRs, ...suggestions.map(s => ({
        ...s,
        id: `kr-ai-${Math.random()}`
      }))]);
    }
    setIsGenerating(false);
  };

  const addManualKR = () => {
    if (!manualKR.title || manualKR.targetValue <= 0 || !manualKR.unit) {
      alert("Vui lòng điền đủ thông tin KR.");
      return;
    }
    setPendingKRs([...pendingKRs, { ...manualKR, id: `kr-${Date.now()}` }]);
    setManualKR({ title: '', targetValue: 0, unit: '' });
  };

  const validateKRs = (krs: any[]) => {
    if (!krs || krs.length < 2) return 'Cần ít nhất 2 KR.';
    for (const kr of krs) {
      if (!kr.title || kr.title.trim() === '') return 'Mỗi KR phải có tiêu đề.';
      if (!kr.unit || kr.unit.trim() === '') return 'Mỗi KR phải có đơn vị (ví dụ: % hoặc tasks).';
      const val = Number(kr.targetValue);
      if (!val || isNaN(val) || val <= 0) return 'Mỗi KR phải có Giá trị mục tiêu (> 0).';
    }
    return null;
  };

  const saveOKR = async () => {
    const validationError = validateKRs(pendingKRs);
    if (!newObjective) return alert('Vui lòng nhập mục tiêu.');
    if (validationError) return alert(validationError);

    const payload: Partial<Objective> = {
      id: editingOKRId || undefined,
      title: newObjective,
      ownerId: user?.id,
      ownerName: user?.name,
      department: user?.department,
      quarter: selectedPeriod.quarter,
      year: selectedPeriod.year,
      status: editingOKRId ? undefined : 'PENDING_APPROVAL',
      keyResults: pendingKRs.map(kr => ({
        id: kr.id || kr._id || `kr-${Math.random()}`,
        title: kr.title,
        targetValue: Number(kr.targetValue),
        unit: kr.unit,
        currentValue: kr.currentValue || 0,
        progress: kr.progress || 0
      }))
    };

    setIsSubmitting(true);
    try {
      if (editingOKRId) {
        const res = await myOkrService.updateMyOKR(editingOKRId, payload);
        const adapted = adaptOKR(res);
        setStatusMessage('Cập nhật OKR thành công');
        // update list optimistically
        setOkrs(prev => prev.map(o => o.id === adapted.id ? adapted : o));
      } else {
        const res = await myOkrService.createMyOKR(payload);
        const adapted = adaptOKR(res);
        setStatusMessage('Tạo OKR thành công');
        setOkrs(prev => [adapted, ...prev]);
      }
      setTimeout(() => setStatusMessage(''), 3000);
      setShowModal(false);
      setNewObjective('');
      setPendingKRs([]);
      setEditingOKRId(null);
    } catch (err: any) {
      // If API failed, attempt fallback save and inform user
      console.warn('API save failed, falling back to local save', err);
      try {
        await dataService.saveOKR(payload);
        await loadOKRs();
        setShowModal(false);
        setEditingOKRId(null);
        alert('Server error — OKR saved locally.');
      } catch (inner) {
        alert('Không thể lưu OKR: ' + (inner as any)?.message || 'Unknown error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteOKR = async (id: string) => {
    if (!confirm('Xóa OKR này?')) return;
    setDeletingId(id);
    try {
      await myOkrService.deleteMyOKR(id);
      setStatusMessage('Xóa OKR thành công');
      setTimeout(() => setStatusMessage(''), 3000);
      setOkrs(prev => prev.filter(o => o.id !== id));
    } catch (err) {
      // fallback
      await dataService.deleteOKR(id);
      await loadOKRs();
    } finally {
      setDeletingId(null);
    }
  };

  const displayOkrs = okrs.filter(o => 
    o.quarter === selectedPeriod.quarter && o.year === selectedPeriod.year &&
    (user?.role === 'ADMIN' || o.department === user?.department)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">OKR {selectedPeriod.quarter}/{selectedPeriod.year}</h2>
        <button onClick={() => { setShowModal(true); setEditingOKRId(null); setPendingKRs([]); setNewObjective(''); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold">Tạo OKR mới</button>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 text-emerald-700 rounded-md">{statusMessage}</div>
      )}

      {isLoading ? (
        <div className="p-6 text-center">Đang tải OKR…</div>
      ) : (
        <div className="grid gap-6">
          {displayOkrs.length === 0 && (
            <div className="p-12 text-center text-slate-400 bg-white border border-dashed rounded-2xl">
              Không tìm thấy OKR nào trong kỳ {selectedPeriod.quarter}/{selectedPeriod.year}.
            </div>
          )}
          {displayOkrs.map(okr => (
            <div key={okr.id} className="bg-white p-6 rounded-2xl border border-slate-200 group relative">
              <div className="flex justify-between mb-4">
                <div>
                  <span className="text-xs font-bold text-indigo-600">{okr.ownerName}</span>
                  <h3 className="text-lg font-bold">{okr.title}</h3>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-black text-indigo-600">{okr.progress || 0}%</span>
                  <div className="opacity-0 group-hover:opacity-100 flex space-x-1">
                    <button onClick={() => { 
                      setEditingOKRId(okr.id); 
                      setNewObjective(okr.title);
                      setPendingKRs(okr.keyResults);
                      setShowModal(true);
                    }} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors">
                      <span className="material-icons">edit</span>
                    </button>
                    <button onClick={() => deleteOKR(okr.id)} disabled={deletingId === okr.id} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                      <span className="material-icons">{deletingId === okr.id ? 'hourglass_top' : 'delete'}</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {okr.keyResults.map((kr, i) => (
                  <div key={i} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-xs font-bold truncate">{kr.title}</p>
                    <div className="flex justify-between text-[10px] mt-1">
                      <span>{kr.currentValue}/{kr.targetValue} {kr.unit}</span>
                      <span className="font-bold">{kr.progress || 0}%</span>
                    </div>
                    <div className="h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{width: `${kr.progress || 0}%`}}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-6 space-y-4 shadow-2xl animate-in zoom-in duration-200">
            <h3 className="text-xl font-bold">{editingOKRId ? 'Chỉnh sửa' : 'Tạo mới'} OKR</h3>
            <textarea 
              value={newObjective} 
              onChange={e => setNewObjective(e.target.value)} 
              placeholder="Nhập mục tiêu lớn của bạn..." 
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
            />
            
            <div className="border border-slate-200 p-4 rounded-xl space-y-3 bg-slate-50">
              <p className="text-xs font-bold uppercase text-slate-500">Thêm Key Results</p>
              <div className="flex space-x-2">
                <input type="text" placeholder="Tên KR" className="flex-1 border p-2 rounded-lg text-sm" value={manualKR.title} onChange={e => setManualKR({...manualKR, title: e.target.value})} />
                <input type="number" placeholder="Gía trị" className="w-20 border p-2 rounded-lg text-sm" value={manualKR.targetValue} onChange={e => setManualKR({...manualKR, targetValue: Number(e.target.value)})} />
                <input type="text" placeholder="Đơn vị" className="w-20 border p-2 rounded-lg text-sm" value={manualKR.unit} onChange={e => setManualKR({...manualKR, unit: e.target.value})} />
                <button onClick={addManualKR} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors">
                  <span className="material-icons">add</span>
                </button>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {pendingKRs.length === 0 && <p className="text-center text-slate-400 text-xs py-2">Chưa có KR nào được thêm.</p>}
                {pendingKRs.map((kr, i) => (
                  <div key={i} className="flex justify-between items-center bg-white p-2 rounded shadow-sm text-sm font-medium">
                    <span className="truncate flex-1">{kr.title} ({kr.targetValue} {kr.unit})</span>
                    <button onClick={() => setPendingKRs(pendingKRs.filter((_, idx) => idx !== i))} className="text-red-500 ml-2">
                      <span className="material-icons text-sm">close</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-indigo-50 p-4 rounded-xl flex items-center justify-between">
              <span className="text-sm font-bold text-indigo-700 flex items-center">
                <span className="material-icons mr-2">psychology</span>
                Gợi ý từ AI
              </span>
              <button 
                onClick={handleGenerateKRs}
                disabled={!newObjective || isGenerating}
                className="bg-white text-indigo-600 text-xs px-4 py-2 rounded-lg font-bold border border-indigo-200 hover:bg-indigo-600 hover:text-white disabled:opacity-50 transition-all"
              >
                {isGenerating ? 'Đang phân tích...' : 'Phân tích & Gợi ý'}
              </button>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 font-bold text-slate-500">Hủy</button>
              <button onClick={saveOKR} disabled={isSubmitting} className={`px-6 py-2 rounded-lg font-bold shadow-lg shadow-indigo-100 transition-all ${isSubmitting ? 'bg-slate-300 text-slate-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                {isSubmitting ? (editingOKRId ? 'Đang lưu…' : 'Đang tạo…') : (editingOKRId ? 'Lưu thay đổi' : 'Gửi phê duyệt')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
