import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { eventService } from '../../services/eventService';
import { Card } from '../../components/atoms/Card';
import { ChevronLeft, Calendar, Trophy, MapPin, AlignLeft, Clock } from 'lucide-react';
import { cn } from '../../utils/cn';
import { format, parseISO } from 'date-fns';

const CreateEvent: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditMode = !!id;

    const [isLoading, setIsLoading] = useState(false);
    
    // 1: Match, 2: Training, 4: Tournament
    const [formData, setFormData] = useState({
        type: 2, 
        title: '',
        date: '',
        time: '',
        location: '',
        description: ''
    });

    useEffect(() => {
        if (isEditMode && id) {
            const loadEvent = async () => {
                try {
                    const event = await eventService.getEvent(id);
                    setFormData({
                        type: event.type === 'match' ? 1 : 2,
                        title: event.title || '',
                        date: format(parseISO(event.start_date), 'yyyy-MM-dd'),
                        time: format(parseISO(event.start_date), 'HH:mm'),
                        location: event.location || '',
                        description: event.description || ''
                    });
                } catch (error) {
                    console.error("Failed to load event", error);
                }
            };
            loadEvent();
        }
    }, [id, isEditMode]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            // Combine date and time
            const start_date = new Date(`${formData.date}T${formData.time}`).toISOString();
            
            const payload = {
                type: formData.type,
                title: formData.title || (formData.type === 2 ? "Entraînement" : "Match Amical"),
                start_date: start_date,
                location: formData.location,
                description: formData.description
            };

            if (isEditMode && id) {
                await eventService.updateEvent(id, payload);
            } else {
                await eventService.createEvent(payload);
            }
            
            navigate('/convocations');
        } catch (error) {
            console.error("Failed to save event", error);
            // Handle error toast here
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 pb-24 max-w-2xl mx-auto animate-fade-in">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-6 transition-colors font-medium">
                <ChevronLeft size={20} />
                Retour
            </button>
            
            <h1 className="text-2xl font-black text-slate-900 mb-8">{isEditMode ? 'Modifier l\'événement' : 'Créer un événement'}</h1>
            
            <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Type Selection */}
                <div className="grid grid-cols-2 gap-4">
                    {[
                        { id: 2, label: 'Entraînement', icon: Calendar, color: 'emerald' },
                        { id: 1, label: 'Match Amical', icon: Trophy, color: 'indigo' },
                    ].map(type => (
                        <div 
                            key={type.id}
                            onClick={() => setFormData({...formData, type: type.id})}
                            className={cn(
                                "cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all",
                                formData.type === type.id 
                                    ? type.id === 2 ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md shadow-emerald-100" :
                                      "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md shadow-indigo-100"
                                    : "border-slate-100 bg-white text-slate-400 hover:border-slate-200 hover:bg-slate-50"
                            )}
                        >
                            <type.icon size={24} />
                            <span className="font-bold text-sm text-center leading-tight">{type.label}</span>
                        </div>
                    ))}
                </div>

                {/* Details */}
                <Card className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Titre (Optionnel)</label>
                        <input 
                            type="text" 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium placeholder:text-slate-400"
                            placeholder={formData.type === 2 ? "Entraînement Physique" : "Match vs..."}
                            value={formData.title}
                            onChange={e => setFormData({...formData, title: e.target.value})}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Date</label>
                            <div className="relative">
                                <Calendar size={18} className="absolute left-3 top-3.5 text-slate-400" />
                                <input 
                                    type="date" 
                                    required
                                    className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                    value={formData.date}
                                    onChange={e => setFormData({...formData, date: e.target.value})}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Heure</label>
                            <div className="relative">
                                <Clock size={18} className="absolute left-3 top-3.5 text-slate-400" />
                                <input 
                                    type="time" 
                                    required
                                    className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                    value={formData.time}
                                    onChange={e => setFormData({...formData, time: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Lieu</label>
                        <div className="relative">
                            <MapPin size={18} className="absolute left-3 top-3.5 text-slate-400" />
                            <input 
                                type="text" 
                                className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium placeholder:text-slate-400"
                                placeholder="Stade municipal..."
                                value={formData.location}
                                onChange={e => setFormData({...formData, location: e.target.value})}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                        <div className="relative">
                            <AlignLeft size={18} className="absolute left-3 top-3.5 text-slate-400" />
                            <textarea 
                                className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px] font-medium placeholder:text-slate-400"
                                placeholder="Objectifs, tenues, consignes..."
                                value={formData.description}
                                onChange={e => setFormData({...formData, description: e.target.value})}
                            />
                        </div>
                    </div>
                </Card>

                <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale"
                >
                    {isLoading ? 'Sauvegarde...' : (isEditMode ? 'Modifier l\'événement' : 'Créer l\'événement')}
                </button>

            </form>
        </div>
    );
};

export default CreateEvent;