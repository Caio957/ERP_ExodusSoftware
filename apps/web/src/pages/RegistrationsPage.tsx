import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PersonType } from '@exodus/shared';
import { Users, Truck, Plus, Pencil, Trash2, X, Search, Phone, MapPin } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { maskCpfCnpj, maskPhone, maskCep } from '../lib/masks';

interface Person {
  id: string;
  code: number;
  type: string;
  name: string;
  tradeName: string | null;
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
    tradeName: person?.tradeName ?? '',
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
  // PJ (CNPJ, >11 dígitos) usa Razão Social/Nome Fantasia; PF (CPF, ≤11) usa
  // Nome Completo/Apelido. Recalculado a cada tecla no campo de documento.
  const isPJ = form.document.replace(/\D/g, '').length > 11;

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        type,
        name: form.name.trim(),
        tradeName: form.tradeName.trim() || undefined,
        // Documento sempre limpo antes de enviar (o schema compartilhado já
        // transforma via onlyDigits, mas a limpeza explícita aqui é defesa em
        // profundidade — CPF/CNPJ é o único campo com validação de formato).
        document: form.document.replace(/\D/g, '') || undefined,
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
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Máscaras em tempo real (CPF/CNPJ, telefone, CEP) — sem dependências externas.
  const setMasked = (k: 'document' | 'phone' | 'zipCode', mask: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: mask(e.target.value) }));

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
        tradeName: data.nome_fantasia || f.tradeName,
        // Sobrescreve com o e-mail da API quando presente — antes ficava
        // preso em '' porque `f.email || data.email` nunca reavalia o lado
        // direito quando o estado local já é uma string vazia truthy-falsy
        // (string vazia é falsy, então na prática funcionava só quando
        // f.email era vazio; a ordem correta prioriza o dado fresco da API).
        email: data.email || f.email,
        // BrasilAPI retorna telefone/CEP crus (sem máscara) — o onChange não
        // dispara em preenchimento programático, então aplicamos as mesmas
        // funções de máscara aqui para o dado "pular" para a tela já formatado.
        phone: f.phone || (data.ddd_telefone_1 ? maskPhone(data.ddd_telefone_1) : ''),
        zipCode: data.cep ? maskCep(data.cep) : f.zipCode,
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

  const Icon = type === 'CLIENT' ? Users : Truck;
  const subtitle =
    type === 'CLIENT'
      ? 'Cadastre os dados pessoais e endereço.'
      : 'Cadastre os dados da empresa parceira.';

  return createPortal(
    <div className="modal-overlay">
      <form
        className="modal-sheet sm:max-w-2xl flex flex-col overflow-hidden !p-0"
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
      >
        {/* Cabeçalho fixo */}
        <div className="shrink-0 flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-600">
              <Icon className="h-6 w-6" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold">
                {person ? `Editar ${label}` : `Novo ${label}`}
              </h2>
              <p className="text-sm text-slate-500">{subtitle}</p>
            </div>
          </div>
          <button type="button" className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo com scroll interno — min-h-0 é obrigatório para o flexbox não estourar o wrapper */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label={isPJ ? 'Razão Social' : 'Nome Completo'}
              required
              value={form.name}
              onChange={set('name')}
            />
            <Field
              label={isPJ ? 'Nome Fantasia' : 'Apelido'}
              value={form.tradeName}
              onChange={set('tradeName')}
            />
            <Field
              label="CPF / CNPJ"
              value={form.document}
              onChange={setMasked('document', maskCpfCnpj)}
              actionIcon={<Search className="h-4 w-4" />}
              onAction={handleCnpjLookup}
              actionLoading={lookingUp}
            />
            <Field label="Telefone" value={form.phone} onChange={setMasked('phone', maskPhone)} />
            <Field label="E-mail" className="sm:col-span-2" value={form.email} onChange={set('email')} />
            <Field
              label="CEP"
              value={form.zipCode}
              onChange={setMasked('zipCode', maskCep)}
              actionIcon={<Search className="h-4 w-4" />}
              onAction={handleCepLookup}
              actionLoading={lookingUp}
            />
            <Field label="Cidade" value={form.city} onChange={set('city')} />
            <Field label="Rua" className="sm:col-span-2" value={form.street} onChange={set('street')} />
            <Field label="Número" value={form.number} onChange={set('number')} />
            <Field label="Bairro" value={form.district} onChange={set('district')} />
            <Field label="UF" value={form.state} onChange={set('state')} maxLength={2} />
          </div>

          {save.error instanceof ApiError && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {save.error.message}
            </div>
          )}
        </div>

        {/* Rodapé fixo */}
        <div className="shrink-0 flex justify-end gap-2 border-t border-slate-100 p-6 pt-4">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={save.isPending || form.name.trim().length < 2}
          >
            {save.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
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
