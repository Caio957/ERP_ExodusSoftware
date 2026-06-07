import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PersonType } from '@exodus/shared';
import { Users, Truck, Plus, Pencil, Trash2, X, Search, Phone, MapPin } from 'lucide-react';
import { api, ApiError } from '../lib/api';

interface Person {
  id: string;
  code: number;
  type: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
}

export function RegistrationsPage() {
  const [tab, setTab] = useState<PersonType>('CLIENT');
  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Cadastros</h1>
        <p className="text-sm text-slate-500">Gerencie clientes e fornecedores da loja.</p>
      </div>

      <div className="flex gap-2">
        <button className={tab === 'CLIENT' ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab('CLIENT')}>
          <Users className="h-5 w-5" /> Clientes
        </button>
        <button className={tab === 'SUPPLIER' ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab('SUPPLIER')}>
          <Truck className="h-5 w-5" /> Fornecedores
        </button>
      </div>

      <PeopleManager type={tab} />
    </div>
  );
}

function PeopleManager({ type }: { type: PersonType }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['persons', type, search],
    queryFn: () => {
      const qs = new URLSearchParams({ type, pageSize: '100' });
      if (search.trim()) qs.set('search', search.trim());
      return api.get<{ items: Person[] }>(`/api/persons?${qs.toString()}`);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/persons/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao excluir'),
  });

  const label = type === 'CLIENT' ? 'cliente' : 'fornecedor';

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-12"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Buscar ${label} por nome ou documento...`}
          />
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          <Plus className="h-5 w-5" /> Novo {label}
        </button>
      </div>

      {isLoading ? (
        <div className="grid h-32 place-items-center text-slate-500">Carregando...</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.items.map((p) => (
            <div key={p.id} className="card-hover flex flex-col">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <span className="mr-2 text-xs font-semibold text-brand-400">#{p.code}</span>
                  <span className="font-display text-base font-bold">{p.name}</span>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-brand-50 hover:text-brand-600"
                    onClick={() => setEditing(p)}
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    onClick={() => {
                      if (window.confirm(`Excluir o ${label} "${p.name}"?`)) remove.mutate(p.id);
                    }}
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {p.document && <div className="text-xs text-slate-400">{p.document}</div>}
              {p.phone && (
                <div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                  <Phone className="h-3.5 w-3.5" /> {p.phone}
                </div>
              )}
              {(p.city || p.street) && (
                <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                  <MapPin className="h-3.5 w-3.5" />
                  {[p.street, p.number, p.city, p.state].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          ))}
          {data?.items.length === 0 && (
            <p className="col-span-full py-10 text-center text-slate-400">
              Nenhum {label} cadastrado.
            </p>
          )}
        </div>
      )}

      {(creating || editing) && (
        <PersonForm
          type={type}
          person={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            qc.invalidateQueries({ queryKey: ['persons'] });
          }}
        />
      )}
    </div>
  );
}

function PersonForm({
  type,
  person,
  onClose,
  onSaved,
}: {
  type: PersonType;
  person: Person | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: person?.name ?? '',
    document: person?.document ?? '',
    phone: person?.phone ?? '',
    email: person?.email ?? '',
    zipCode: person?.zipCode ?? '',
    street: person?.street ?? '',
    number: person?.number ?? '',
    district: person?.district ?? '',
    city: person?.city ?? '',
    state: person?.state ?? '',
  });
  const label = type === 'CLIENT' ? 'cliente' : 'fornecedor';
  const [lookingUp, setLookingUp] = useState(false);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        type,
        name: form.name.trim(),
        document: form.document.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        zipCode: form.zipCode.trim() || undefined,
        street: form.street.trim() || undefined,
        number: form.number.trim() || undefined,
        district: form.district.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
      };
      return person ? api.put(`/api/persons/${person.id}`, payload) : api.post('/api/persons', payload);
    },
    onSuccess: onSaved,
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao salvar'),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleCnpjLookup = async () => {
    const cleanDoc = form.document.replace(/\D/g, '');
    if (cleanDoc.length !== 14) {
      window.alert('Digite um CNPJ válido com 14 dígitos para buscar.');
      return;
    }
    
    setLookingUp(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanDoc}`);
      if (!res.ok) throw new Error('CNPJ não encontrado na BrasilAPI.');
      const data = await res.json();
      
      setForm(f => ({
        ...f,
        name: f.name || data.razao_social || '',
        email: f.email || data.email || '',
        phone: f.phone || data.ddd_telefone_1 || '',
        zipCode: data.cep || f.zipCode,
        street: data.logradouro || f.street,
        number: data.numero || f.number,
        district: data.bairro || f.district,
        city: data.municipio || f.city,
        state: data.uf || f.state,
      }));
    } catch (err: any) {
      window.alert(err.message || 'Erro ao buscar CNPJ.');
    } finally {
      setLookingUp(false);
    }
  };

  const handleCepLookup = async () => {
    const cleanCep = form.zipCode.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      window.alert('Digite um CEP válido com 8 dígitos para buscar.');
      return;
    }
    
    setLookingUp(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
      if (!res.ok) throw new Error('CEP não encontrado.');
      const data = await res.json();
      
      setForm(f => ({
        ...f,
        street: data.street || f.street,
        district: data.neighborhood || f.district,
        city: data.city || f.city,
        state: data.state || f.state,
      }));
    } catch (err: any) {
      window.alert(err.message || 'Erro ao buscar CEP.');
    } finally {
      setLookingUp(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-xl animate-scale-in overflow-auto rounded-2xl bg-white p-6 shadow-elevated">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">
            {person ? `Editar ${label}` : `Novo ${label}`}
          </h2>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome" required className="col-span-2" value={form.name} onChange={set('name')} />
          <Field 
            label="CPF / CNPJ" 
            value={form.document} 
            onChange={set('document')} 
            actionIcon={<Search className="h-4 w-4" />}
            onAction={handleCnpjLookup}
            actionLoading={lookingUp}
          />
          <Field label="Telefone" value={form.phone} onChange={set('phone')} />
          <Field label="E-mail" className="col-span-2" value={form.email} onChange={set('email')} />
          <Field 
            label="CEP" 
            value={form.zipCode} 
            onChange={set('zipCode')} 
            actionIcon={<Search className="h-4 w-4" />}
            onAction={handleCepLookup}
            actionLoading={lookingUp}
          />
          <Field label="Cidade" value={form.city} onChange={set('city')} />
          <Field label="Rua" className="col-span-2" value={form.street} onChange={set('street')} />
          <Field label="Número" value={form.number} onChange={set('number')} />
          <Field label="Bairro" value={form.district} onChange={set('district')} />
          <Field label="UF" value={form.state} onChange={set('state')} maxLength={2} />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            disabled={save.isPending || form.name.trim().length < 2}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  className = '',
  actionIcon,
  onAction,
  actionLoading,
  ...props
}: { 
  label: string; 
  required?: boolean;
  actionIcon?: React.ReactNode;
  onAction?: () => void;
  actionLoading?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="label">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      <div className="relative">
        <input className={`input w-full ${actionIcon ? 'pr-10' : ''}`} {...props} />
        {actionIcon && (
          <button 
            type="button" 
            onClick={onAction} 
            disabled={actionLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-600 disabled:opacity-50"
            title="Buscar na BrasilAPI"
          >
            {actionLoading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" /> : actionIcon}
          </button>
        )}
      </div>
    </label>
  );
}
