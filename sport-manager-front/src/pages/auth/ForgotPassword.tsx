import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Mail, Trophy } from 'lucide-react';

import { Card } from '../../components/atoms/Card';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { authService } from '../../services/authService';
import { getErrorMessage } from '../../utils/getErrorMessage';

const ForgotPassword: React.FC = () => {
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const emailError = useMemo(() => {
        if (!submitted) return undefined;
        if (email.trim().length < 3) return 'Email requis.';
        return undefined;
    }, [email, submitted]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
        setError(null);
        setMessage(null);

        if (email.trim().length < 3) return;

        setIsLoading(true);
        try {
            const res = await authService.forgotPassword(email.trim());
            setMessage(res.message || 'Si cet email existe, un lien de réinitialisation a été envoyé.');
        } catch (err) {
            setError(getErrorMessage(err, 'Impossible de lancer la réinitialisation.'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a16] relative overflow-hidden p-4">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px]" />
            </div>

            <div className="w-full max-w-md relative z-10 animate-fade-in-up">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-[0_0_40px_rgba(79,70,229,0.3)] mb-6 transform rotate-3">
                        <Trophy size={40} className="text-white" />
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tight mb-2">
                        Neo<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400">Sport</span>
                    </h1>
                    <p className="text-slate-400 font-medium">Réinitialiser votre mot de passe.</p>
                </div>

                <Card variant="glass" className="backdrop-blur-xl bg-white/5 border-white/10 p-8 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Input
                            label="Email"
                            type="email"
                            placeholder="coach@club.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            leftIcon={<Mail size={18} />}
                            required
                            error={emailError}
                            className="bg-slate-800 text-white placeholder-slate-400 border-slate-600 focus:border-indigo-500 focus:ring-indigo-500/20 focus-visible:bg-slate-800"
                            labelClassName="text-slate-300"
                        />

                        {(error || message) && (
                            <div
                                className={
                                    'p-3 rounded-lg border flex items-center gap-3 text-sm ' +
                                    (error
                                        ? 'bg-red-500/10 border-red-500/20 text-red-200'
                                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200')
                                }
                            >
                                <AlertCircle size={18} className="shrink-0" />
                                {error || message}
                            </div>
                        )}

                        <Button
                            type="submit"
                            size="lg"
                            className="w-full h-12 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 border-none shadow-lg shadow-indigo-500/25"
                            isLoading={isLoading}
                        >
                            Envoyer le lien
                        </Button>
                    </form>
                </Card>

                <p className="text-center text-slate-500 text-sm mt-8">
                    <button
                        type="button"
                        onClick={() => navigate('/login')}
                        className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
                    >
                        Retour à la connexion
                    </button>
                </p>
            </div>
        </div>
    );
};

export default ForgotPassword;
