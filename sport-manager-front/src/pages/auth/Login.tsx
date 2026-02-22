import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { Mail, Lock, LogIn, AlertCircle, Trophy } from 'lucide-react';
import { Card } from '../../components/atoms/Card';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        
        try {
            const response = await authService.login(email, password);
            login(response.user);
            navigate('/');
        } catch (err: any) {
            console.error(err);
            setError("Email ou mot de passe incorrect.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a16] relative overflow-hidden p-4">
            
            {/* Background Ambient Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px]"></div>
            </div>

            <div className="w-full max-w-md relative z-10 animate-fade-in-up">
                
                {/* Brand Logo Area */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-[0_0_40px_rgba(79,70,229,0.3)] mb-6 transform rotate-3">
                        <Trophy size={40} className="text-white" />
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tight mb-2">
                        Neo<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400">Sport</span>
                    </h1>
                    <p className="text-slate-400 font-medium">L'excellence sportive, réinventée.</p>
                </div>

                <Card variant="glass" className="backdrop-blur-xl bg-white/5 border-white/10 p-8 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <Input 
                                label="Email Professionnel"
                                type="email"
                                placeholder="coach@club.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                leftIcon={<Mail size={18} />}
                                required
                                className="bg-slate-800 text-white placeholder-slate-400 border-slate-600 focus:border-indigo-500 focus:ring-indigo-500/20 focus-visible:bg-slate-800"
                                labelClassName="text-slate-300"
                            />
                            
                            <div className="space-y-1">
                                <Input 
                                    label="Mot de passe"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    leftIcon={<Lock size={18} />}
                                    required
                                    className="bg-slate-800 text-white placeholder-slate-400 border-slate-600 focus:border-indigo-500 focus:ring-indigo-500/20 focus-visible:bg-slate-800"
                                    labelClassName="text-slate-300"
                                />
                                <div className="flex justify-end">
                                    <button type="button" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
                                        Mot de passe oublié ?
                                    </button>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-200 text-sm">
                                <AlertCircle size={18} className="shrink-0" />
                                {error}
                            </div>
                        )}

                        <Button 
                            type="submit" 
                            size="lg" 
                            className="w-full h-12 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 border-none shadow-lg shadow-indigo-500/25"
                            isLoading={isLoading}
                        >
                            <LogIn className="mr-2 h-5 w-5" />
                            Se connecter
                        </Button>
                    </form>
                </Card>

                <p className="text-center text-slate-500 text-sm mt-8">
                    Pas encore de compte ? <button className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors">Rejoindre un club</button>
                </p>
            </div>
        </div>
    );
}

export default Login;
