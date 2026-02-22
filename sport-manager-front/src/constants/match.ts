import { Goal, Shield, UserPlus, Target, Crosshair, StickyNote, PieChart } from 'lucide-react';

export const MATCH_ACTIONS = [
    { id: 1, label: 'But', icon: Goal, color: 'bg-emerald-500', text: 'text-emerald-500' },
    { id: 2, label: 'Carton Jaune', icon: Shield, color: 'bg-yellow-400', text: 'text-yellow-600' },
    { id: 3, label: 'Carton Rouge', icon: Shield, color: 'bg-red-600', text: 'text-red-600' },
    { id: 4, label: 'Remplacement', icon: UserPlus, color: 'bg-blue-500', text: 'text-blue-500' },
    { id: 5, label: 'Tir', icon: Target, color: 'bg-indigo-400', text: 'text-indigo-400' },         
    { id: 6, label: 'Tir Cadré', icon: Crosshair, color: 'bg-indigo-600', text: 'text-indigo-600' }, 
    { id: 17, label: 'Fait de jeu', icon: StickyNote, color: 'bg-orange-500', text: 'text-orange-500' },
    { id: 18, label: 'Possession', icon: PieChart, color: 'bg-slate-600', text: 'text-slate-300' },
];
