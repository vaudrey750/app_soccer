import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Building2, Lock, Mail, Trophy, User } from 'lucide-react';

import { Card } from '../../components/atoms/Card';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { authService } from '../../services/authService';
import { referenceService, type ClubSearchItem } from '../../services/referenceService.ts';
import { getErrorMessage } from '../../utils/getErrorMessage';

const Signup: React.FC = () => {
    const navigate = useNavigate();

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [clubName, setClubName] = useState('');
    const [isFffLinked, setIsFffLinked] = useState(false);
    const [fffRealClubId, setFffRealClubId] = useState('');

    const [clubSuggestions, setClubSuggestions] = useState<ClubSearchItem[]>([]);
    const [isSearchingClub, setIsSearchingClub] = useState(false);
    const [clubSearchError, setClubSearchError] = useState<string | null>(null);
    const [isClubDropdownOpen, setIsClubDropdownOpen] = useState(false);

    const [submitted, setSubmitted] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const fieldErrors = useMemo(() => {
        const errors: Record<string, string | undefined> = {};

        if (fullName.trim().length < 2) errors.fullName = 'Nom et prénom requis.';
        if (email.trim().length < 3) errors.email = 'Email requis.';
        if (password.length < 8) errors.password = 'Mot de passe (8 caractères min).';

        const club = clubName.trim();
        if (club.length < 2) {
            errors.clubName = 'Nom du club requis.';
        } else if (isFffLinked && fffRealClubId.trim().length === 0) {
            errors.clubName = 'Sélectionnez un club dans la liste (club officiel requis).';
        }

        return errors;
    }, [clubName, email, fffRealClubId, fullName, isFffLinked, password.length]);

    const hasAnyError = Object.values(fieldErrors).some(Boolean);

    useEffect(() => {
        if (!isFffLinked) {
            setClubSuggestions([]);
            setClubSearchError(null);
            setIsSearchingClub(false);
            setIsClubDropdownOpen(false);
            return;
        }

        const q = clubName.trim();
        if (q.length < 2) {
            setClubSuggestions([]);
            setClubSearchError(null);
            setIsSearchingClub(false);
            return;
        }

        let cancelled = false;
        setIsSearchingClub(true);
        setClubSearchError(null);

        const t = window.setTimeout(async () => {
            try {
                const results = await referenceService.searchFffClubs(q);
                if (cancelled) return;
                setClubSuggestions(Array.isArray(results) ? results : []);
            } catch (err) {
                if (cancelled) return;
                setClubSuggestions([]);
                setClubSearchError(getErrorMessage(err, 'Recherche de clubs impossible.'));
            } finally {
                if (!cancelled) setIsSearchingClub(false);
            }
        }, 250);

        return () => {
            cancelled = true;
            window.clearTimeout(t);
        };
    }, [clubName, isFffLinked]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        if (hasAnyError) return;

        setIsLoading(true);
        try {
            const res = await authService.signup({
                full_name: fullName.trim(),
                email: email.trim(),
                password,
                club_name: clubName.trim(),
                is_fff_linked: isFffLinked,
                fff_real_club_id: isFffLinked ? fffRealClubId.trim() : undefined,
            });
            setSuccessMessage(res.message || 'Compte créé avec succès.');
            window.setTimeout(() => navigate('/login'), 800);
        } catch (err) {
            setErrorMessage(getErrorMessage(err, "Impossible de créer le compte."));
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
                    <p className="text-slate-400 font-medium">Créer un espace club.</p>
                </div>

                <Card variant="glass" className="backdrop-blur-xl bg-white/5 border-white/10 p-8 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <Input
                                label="Nom et prénom"
                                placeholder="Jean Dupont"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                leftIcon={<User size={18} />}
                                required
                                error={submitted ? fieldErrors.fullName : undefined}
                                className="bg-slate-800 text-white placeholder-slate-400 border-slate-600 focus:border-indigo-500 focus:ring-indigo-500/20 focus-visible:bg-slate-800"
                                labelClassName="text-slate-300"
                            />
                            <Input
                                label="Email Professionnel"
                                type="email"
                                placeholder="president@club.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                leftIcon={<Mail size={18} />}
                                required
                                error={submitted ? fieldErrors.email : undefined}
                                className="bg-slate-800 text-white placeholder-slate-400 border-slate-600 focus:border-indigo-500 focus:ring-indigo-500/20 focus-visible:bg-slate-800"
                                labelClassName="text-slate-300"
                            />
                            <Input
                                label="Mot de passe"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                leftIcon={<Lock size={18} />}
                                required
                                error={submitted ? fieldErrors.password : undefined}
                                className="bg-slate-800 text-white placeholder-slate-400 border-slate-600 focus:border-indigo-500 focus:ring-indigo-500/20 focus-visible:bg-slate-800"
                                labelClassName="text-slate-300"
                            />

                            <div className="space-y-2">
                                <div className="text-sm font-bold text-slate-300 ml-1">Club lié à la FFF</div>
                                <div className="flex p-1 bg-slate-800/70 border border-slate-700 rounded-2xl">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsFffLinked(false);
                                            setFffRealClubId('');
                                            setClubSuggestions([]);
                                            setClubSearchError(null);
                                        }}
                                        className={
                                            'flex-1 h-10 rounded-xl text-xs font-black uppercase tracking-wide transition-all ' +
                                            (!isFffLinked
                                                ? 'bg-white text-indigo-700 shadow-sm'
                                                : 'text-slate-300 hover:text-white')
                                        }
                                    >
                                        Non
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsFffLinked(true);
                                            setIsClubDropdownOpen(true);
                                        }}
                                        className={
                                            'flex-1 h-10 rounded-xl text-xs font-black uppercase tracking-wide transition-all ' +
                                            (isFffLinked
                                                ? 'bg-white text-indigo-700 shadow-sm'
                                                : 'text-slate-300 hover:text-white')
                                        }
                                    >
                                        Oui
                                    </button>
                                </div>

                                <Input
                                    label={isFffLinked ? 'Club officiel (FFF)' : 'Nom du club'}
                                    placeholder={isFffLinked ? 'Tapez le nom du club…' : 'FC Exemple'}
                                    value={clubName}
                                    onChange={(e) => {
                                        const next = e.target.value;
                                        setClubName(next);
                                        if (isFffLinked) {
                                            setFffRealClubId('');
                                            setIsClubDropdownOpen(true);
                                        }
                                    }}
                                    onFocus={() => {
                                        if (isFffLinked) setIsClubDropdownOpen(true);
                                    }}
                                    onBlur={() => {
                                        if (!isFffLinked) return;
                                        window.setTimeout(() => setIsClubDropdownOpen(false), 150);
                                    }}
                                    leftIcon={<Building2 size={18} />}
                                    required
                                    error={submitted ? fieldErrors.clubName : undefined}
                                    className="bg-slate-800 text-white placeholder-slate-400 border-slate-600 focus:border-indigo-500 focus:ring-indigo-500/20 focus-visible:bg-slate-800"
                                    labelClassName="text-slate-300"
                                />

                                {isFffLinked && (isClubDropdownOpen || isSearchingClub) && clubName.trim().length >= 2 && (
                                    <div className="-mt-2 rounded-2xl border border-slate-700 bg-slate-900/70 overflow-hidden">
                                        {isSearchingClub ? (
                                            <div className="px-4 py-3 text-xs font-semibold text-slate-300">Recherche…</div>
                                        ) : clubSearchError ? (
                                            <div className="px-4 py-3 text-xs font-semibold text-rose-200">{clubSearchError}</div>
                                        ) : clubSuggestions.length === 0 ? (
                                            <div className="px-4 py-3 text-xs font-semibold text-slate-400">Aucun résultat.</div>
                                        ) : (
                                            <div className="max-h-56 overflow-auto">
                                                {clubSuggestions.map((c) => (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onMouseDown={(ev) => ev.preventDefault()}
                                                        onClick={() => {
                                                            setClubName(c.label);
                                                            setFffRealClubId(c.id);
                                                            setIsClubDropdownOpen(false);
                                                        }}
                                                        className="w-full px-4 py-3 text-left hover:bg-slate-800/60 transition-colors"
                                                    >
                                                        <div className="text-sm font-bold text-white truncate">{c.label}</div>
                                                        <div className="text-[11px] font-semibold text-slate-400">ID FFF : {c.id}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {isFffLinked && fffRealClubId.trim().length > 0 && (
                                    <div className="px-3 py-2 rounded-2xl bg-slate-800/50 border border-slate-700 text-xs font-semibold text-slate-300">
                                        Club sélectionné — ID FFF :{' '}
                                        <span className="font-black text-white">{fffRealClubId}</span>
                                    </div>
                                )}

                                {isFffLinked && (
                                    <p className="text-xs text-slate-500">
                                        Un club FFF ne peut être créé que par le président (email ou nom/prénom identiques aux données FFF).
                                    </p>
                                )}
                            </div>
                        </div>

                        {(errorMessage || successMessage) && (
                            <div
                                className={
                                    'p-3 rounded-lg border flex items-center gap-3 text-sm ' +
                                    (errorMessage
                                        ? 'bg-red-500/10 border-red-500/20 text-red-200'
                                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200')
                                }
                            >
                                <AlertCircle size={18} className="shrink-0" />
                                {errorMessage || successMessage}
                            </div>
                        )}

                        <Button
                            type="submit"
                            size="lg"
                            className="w-full h-12 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 border-none shadow-lg shadow-indigo-500/25"
                            isLoading={isLoading}
                        >
                            Créer mon compte
                        </Button>
                    </form>
                </Card>

                <p className="text-center text-slate-500 text-sm mt-8">
                    Déjà un compte ?{' '}
                    <button
                        type="button"
                        onClick={() => navigate('/login')}
                        className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
                    >
                        Se connecter
                    </button>
                </p>
            </div>
        </div>
    );
};

export default Signup;
