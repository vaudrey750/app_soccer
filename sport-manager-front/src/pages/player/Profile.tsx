import React, { useState, useEffect } from 'react';
import { Button } from '../../components/atoms/Button';
import { Card } from '../../components/atoms/Card';
import { Input } from '../../components/atoms/Input';
import { 
    User as UserIcon, Mail, Phone, Calendar, Flag, Edit3, Camera, Save, LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { memberService } from '../../services/memberService';
import { useNavigate } from 'react-router-dom';

const Profile: React.FC = () => {
    const { user: authUser, logout } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Initial state matching the UI needs
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        role: 'Membre',
        nationality: 'Française',
        birthDate: '1998-01-01',
        email: '',
        phone: '',
        avatar: '',
        position: 'Joueur',
        height: '178', // Default for now until backend supports it
        weight: '72',
        strongFoot: 'Droit'
    });

    useEffect(() => {
        const fetchProfile = async () => {
            if (!authUser?.id) return;
            try {
                // Here we fetch the full member details which might have more info than the token
                const memberData = await memberService.getMember(authUser.id);
                
                setFormData(prev => ({
                    ...prev,
                    firstName: memberData.first_name || authUser.firstName,
                    lastName: memberData.last_name || authUser.lastName,
                    email: memberData.email || authUser.email,
                    phone: memberData.phone || '',
                    role: memberData.role || authUser.role,
                    position: memberData.position || 'Joueur',
                    nationality: memberData.country || 'Française',
                    // Use UI Avatars if no photo provided
                    avatar: memberData.photo_url || `https://ui-avatars.com/api/?name=${memberData.first_name}+${memberData.last_name}&background=random&color=fff&background=6366f1`,
                    birthDate: memberData.medical_certificate_date || prev.birthDate // Using med cert date as placeholder or need real DOB field
                }));
            } catch (error) {
                console.error("Failed to load profile", error);
            }
        };
        fetchProfile();
    }, [authUser]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        if (!authUser?.id) return;
        setIsLoading(true);
        try {
            await memberService.updateMember(authUser.id, {
                first_name: formData.firstName,
                last_name: formData.lastName,
                email: formData.email,
                phone: formData.phone
            });
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to update profile", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20 p-4 md:p-8 animate-fade-in">
            {/* --- HEADER IDENTITY --- */}
            <div className="relative bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-900 rounded-[2.5rem] p-8 text-white shadow-2xl overflow-hidden mb-8">
                {/* Background FX */}
                <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-indigo-500/30 rounded-full blur-[80px]"></div>
                <div className="absolute bottom-[-30px] left-[-30px] w-48 h-48 bg-blue-500/20 rounded-full blur-[60px]"></div>

                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    {/* Avatar */}
                    <div className="relative group">
                         <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-[6px] border-white/10 shadow-2xl overflow-hidden bg-indigo-950">
                             <img src={formData.avatar} alt="Avatar" className="w-full h-full object-cover" />
                         </div>
                         {isEditing && (
                            <button className="absolute bottom-2 right-2 p-2.5 bg-blue-500 hover:bg-blue-400 text-white rounded-full shadow-lg transition-all border border-white/20">
                                <Camera size={18} />
                            </button>
                         )}
                    </div>

                    {/* Infos */}
                    <div className="flex-1 text-center md:text-left space-y-2">
                        <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-bold tracking-wider uppercase text-blue-200 mb-1">
                            {formData.role} Du Club
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white/90">
                            {formData.firstName} <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-indigo-100">{formData.lastName}</span>
                        </h1>
                        <div className="flex flex-wrap gap-4 justify-center md:justify-start text-sm font-semibold text-indigo-200/80">
                             <span className="flex items-center gap-1.5"><Flag size={15} /> {formData.nationality}</span>
                             <span className="flex items-center gap-1.5"><Calendar size={15} /> {new Date(formData.birthDate).toLocaleDateString()}</span>
                        </div>
                    </div>

                    {/* Action */}
                    <Button 
                        variant={isEditing ? "glass" : "glass"} 
                        className="h-12 px-6 rounded-2xl"
                        onClick={() => setIsEditing(!isEditing)}
                    >
                        {isEditing ? (
                            <>Annuler</>
                        ) : (
                            <><Edit3 className="mr-2 h-4 w-4" /> Modifier</>
                        )}
                    </Button>
                </div>
            </div>

            {/* --- DASHBOARD GRID --- */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Athletic Profile (Left Column) */}
                <div className="md:col-span-4 space-y-6">
                    <Card variant="default" className="h-full border-t-[6px] border-t-indigo-500">
                        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                            PROFIL ATHLÉTIQUE
                        </h3>
                        {/* Stats Metrics */}
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-100">
                                <span className="block text-3xl font-black text-indigo-600">{formData.height}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cm</span>
                            </div>
                            <div className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-100">
                                <span className="block text-3xl font-black text-indigo-600">{formData.weight}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kg</span>
                            </div>
                        </div>

                        {/* Bars / Details */}
                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between text-sm font-extrabold text-slate-600 mb-2">
                                    <span>Pied Fort</span>
                                    <span className="text-indigo-600">{formData.strongFoot}</span>
                                </div>
                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                     <div className="h-full w-full bg-gradient-to-r from-indigo-500 to-blue-500"></div>
                                </div>
                            </div>
                         </div>
                    </Card>
                </div>

                {/* Personal Info Form (Right Column) */}
                <div className="md:col-span-8">
                    <Card className="h-full">
                        <h3 className="text-lg font-black text-slate-800 mb-6 border-b border-slate-100 pb-4">
                            INFORMATIONS PERSONNELLES
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input 
                                label="Prénom" 
                                name="firstName"
                                value={formData.firstName} 
                                onChange={handleInputChange}
                                disabled={!isEditing}
                                leftIcon={<UserIcon size={18}/>} 
                            />
                            <Input 
                                label="Nom" 
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleInputChange} 
                                disabled={!isEditing}
                                leftIcon={<UserIcon size={18}/>} 
                            />
                            <Input 
                                label="Email" 
                                type="email" 
                                name="email"
                                value={formData.email} 
                                onChange={handleInputChange}
                                disabled={!isEditing}
                                leftIcon={<Mail size={18}/>} 
                            />
                            <Input 
                                label="Téléphone" 
                                type="tel" 
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange} 
                                disabled={!isEditing}
                                leftIcon={<Phone size={18}/>} 
                            />
                        </div>
                        
                        {isEditing && (
                            <div className="mt-8 flex justify-end pt-6 border-t border-slate-50 gap-4">
                                <Button 
                                    size="lg" 
                                    className="w-full md:w-auto shadow-indigo-200"
                                    onClick={handleSave}
                                    isLoading={isLoading}
                                >
                                    <Save className="mr-2 h-4 w-4" />
                                    Enregistrer les modifications
                                </Button>
                            </div>
                        )}
                        
                        {/* Logout Zone */}
                         <div className="mt-8 pt-6 border-t border-slate-50">
                            <Button 
                                variant="ghost" 
                                className="w-full text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => {
                                    logout();
                                    navigate('/login');
                                }}
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                Se déconnecter
                            </Button>
                        </div>
                    </Card>
                </div>

            </div>
        </div>
    );
};

export default Profile;
