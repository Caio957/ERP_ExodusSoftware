import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { onboardingSchema, type OnboardingResponse } from '@exodus/shared';
import {
  Sparkles,
  Building2,
  IdCard,
  User,
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  Rocket,
  ShieldCheck,
  Gem,
  PartyPopper,
  FileText,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { maskCpfCnpj } from '../lib/masks';
import { LegalDocumentModal } from '../components/legal/LegalDocumentModal';
import { TermsOfUseContent } from '../components/legal/TermsOfUse';
import { PrivacyPolicyContent } from '../components/legal/PrivacyPolicy';

const highlights = [
  { icon: Rocket, title: 'Comece agora', desc: 'Cadastre sua loja em menos de 2 minutos.', gold: false },
  { icon: ShieldCheck, title: 'Aprovação rápida', desc: 'Nossa equipe libera seu acesso após uma checagem.', gold: true },
  { icon: Gem, title: 'Sem burocracia', desc: 'Sem fidelidade e sem taxa de adesão.', gold: false },
];

/**
 * `onboardingSchema` (shared) é o contrato REAL com o backend — reaproveitado
 * como base para não duplicar regra de validação. O consentimento LGPD é
 * *puramente* uma trava de frontend (a API não tem, nem precisa ter, esse
 * campo): estendido aqui, fora do pacote compartilhado, e removido do
 * payload antes do POST.
 */
const onboardingFormSchema = onboardingSchema.extend({
  consent: z.boolean().refine((v) => v === true, {
    message: 'Você precisa aceitar os Termos de Uso e a Política de Privacidade (LGPD) para continuar.',
  }),
});
type OnboardingFormValues = z.infer<typeof onboardingFormSchema>;

function SuccessState({ onBack }: { onBack: () => void }) {
  return (
    <div className="animate-scale-in text-center">
      <span className="icon-tile-gold mx-auto mb-5 h-16 w-16">
        <PartyPopper className="h-8 w-8" />
      </span>
      <h2 className="font-display text-2xl font-extrabold text-ink-900">
        Sua loja foi cadastrada com <span className="gradient-text">sucesso</span>!
      </h2>
      <p className="mt-3 text-slate-500">
        Nossa equipe está analisando os dados e em breve o seu acesso será liberado.
      </p>
      <button type="button" className="btn-primary mt-7 w-full text-lg" onClick={onBack}>
        <ArrowLeft className="h-5 w-5" /> Voltar ao Login
      </button>
    </div>
  );
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingFormSchema),
    defaultValues: { companyName: '', cnpj: '', adminName: '', email: '', password: '', consent: false },
  });

  const mutation = useMutation({
    mutationFn: (payload: Omit<OnboardingFormValues, 'consent'>) =>
      api.post<OnboardingResponse>('/api/onboarding', payload, { auth: false }),
    onSuccess: () => setSuccess(true),
  });

  function onSubmit(values: OnboardingFormValues) {
    // `consent` nunca vai para a API — o backend não espera (nem valida)
    // esse campo; é só a trava de LGPD do próprio formulário.
    const { consent: _consent, ...payload } = values;
    mutation.mutate(payload);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Painel de marca — mesmo motivo visual escuro/dourado do Login */}
      <aside className="relative hidden overflow-hidden bg-royal-gradient lg:flex lg:flex-col lg:justify-between lg:p-12 lg:text-white">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 animate-spin-slow bg-shine opacity-70" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 animate-float rounded-full bg-accent-400/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 animate-float-slow rounded-full bg-brand-400/40 blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 top-1/3 h-64 w-64 animate-glow-pulse rounded-full bg-accent-500/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-grid bg-[length:38px_38px] opacity-25 [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]" />

        <div className="relative flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-2xl font-bold ring-1 ring-accent-300/50 backdrop-blur-sm">
            E
          </span>
          <div>
            <div className="font-display text-xl font-extrabold leading-none">Exodus</div>
            <div className="text-sm text-accent-200/80">Software</div>
          </div>
        </div>

        <div className="relative max-w-md">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent-400/15 px-3 py-1 text-sm font-semibold text-accent-100 ring-1 ring-accent-300/40 backdrop-blur-sm">
            <Sparkles className="h-4 w-4" /> Novo por aqui?
          </div>
          <h1 className="font-display text-4xl font-extrabold leading-tight xl:text-5xl">
            Crie sua loja
            <br />
            <span className="gradient-text-gold">em poucos minutos.</span>
          </h1>
          <p className="mt-4 text-lg text-blue-100/80">
            Cadastre sua empresa e comece a usar o ERP feito para o balcão.
          </p>

          <ul className="mt-8 space-y-3">
            {highlights.map((h) => (
              <li
                key={h.title}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md transition-all duration-300 hover:translate-x-1.5 hover:bg-white/10"
              >
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-lg ${
                    h.gold ? 'bg-gold-gradient text-ink-900' : 'bg-brand-gradient text-white'
                  }`}
                >
                  <h.icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-bold">{h.title}</div>
                  <div className="text-sm text-blue-100/70">{h.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-sm text-blue-100/60">
          <Gem className="h-4 w-4 text-accent-300" />© {new Date().getFullYear()} Exodus Software · Feito para o
          varejo de beleza
        </div>
      </aside>

      {/* Formulário */}
      <main className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="gradient-border w-full max-w-md animate-fade-in rounded-3xl bg-white/80 p-6 shadow-card backdrop-blur-xl sm:p-8">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <div className="mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-brand-gradient text-3xl font-bold text-white shadow-brand ring-2 ring-accent-300">
              E
            </div>
            <h1 className="font-display text-2xl font-extrabold gradient-text">Exodus Software</h1>
            <p className="text-slate-500">ERP para lojas de cosméticos</p>
          </div>

          {success ? (
            <SuccessState onBack={() => navigate('/login')} />
          ) : (
            <>
              <div className="mb-6">
                <h2 className="font-display text-3xl font-extrabold">
                  Crie sua <span className="gradient-text">loja</span>
                </h2>
                <p className="mt-1 text-slate-500">Preencha os dados abaixo para começar.</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div>
                  <label className="label">Nome da empresa</label>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                    <input
                      className="input pl-11"
                      autoComplete="organization"
                      placeholder="Ex: Cosméticos da Ana"
                      {...register('companyName')}
                    />
                  </div>
                  {errors.companyName && (
                    <span className="mt-1 block text-xs font-medium text-rose-500">
                      {errors.companyName.message}
                    </span>
                  )}
                </div>

                <div>
                  <label className="label">CNPJ ou CPF</label>
                  <div className="relative">
                    <IdCard className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                    <Controller
                      control={control}
                      name="cnpj"
                      render={({ field }) => (
                        <input
                          className="input pl-11"
                          inputMode="numeric"
                          maxLength={18}
                          placeholder="00.000.000/0000-00"
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          value={field.value}
                          onChange={(e) => field.onChange(maskCpfCnpj(e.target.value))}
                        />
                      )}
                    />
                  </div>
                  {errors.cnpj && (
                    <span className="mt-1 block text-xs font-medium text-rose-500">{errors.cnpj.message}</span>
                  )}
                </div>

                <div>
                  <label className="label">Nome do proprietário</label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                    <input
                      className="input pl-11"
                      autoComplete="name"
                      placeholder="Seu nome completo"
                      {...register('adminName')}
                    />
                  </div>
                  {errors.adminName && (
                    <span className="mt-1 block text-xs font-medium text-rose-500">
                      {errors.adminName.message}
                    </span>
                  )}
                </div>

                <div>
                  <label className="label">E-mail</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                    <input
                      className="input pl-11"
                      type="email"
                      autoComplete="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      inputMode="email"
                      placeholder="voce@sualoja.com.br"
                      {...register('email')}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Esse e-mail será o login do administrador da loja.</p>
                  {errors.email && (
                    <span className="mt-1 block text-xs font-medium text-rose-500">{errors.email.message}</span>
                  )}
                </div>

                <div>
                  <label className="label">Senha</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                    <input
                      className="input pl-11"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Mínimo de 8 caracteres"
                      {...register('password')}
                    />
                  </div>
                  {errors.password && (
                    <span className="mt-1 block text-xs font-medium text-rose-500">
                      {errors.password.message}
                    </span>
                  )}
                </div>

                <div>
                  <label className="flex items-start gap-2.5 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600"
                      {...register('consent')}
                    />
                    Li e concordo com os{' '}
                    <button
                      type="button"
                      className="font-semibold text-brand-700 underline-offset-2 hover:underline"
                      onClick={() => setShowTerms(true)}
                    >
                      Termos de Uso
                    </button>{' '}
                    e a{' '}
                    <button
                      type="button"
                      className="font-semibold text-brand-700 underline-offset-2 hover:underline"
                      onClick={() => setShowPrivacy(true)}
                    >
                      Política de Privacidade (LGPD)
                    </button>
                    .
                  </label>
                  {errors.consent && (
                    <span className="mt-1 block text-xs font-medium text-rose-500">
                      {errors.consent.message}
                    </span>
                  )}
                </div>

                {mutation.isError && (
                  <div className="animate-scale-in rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
                    {mutation.error instanceof ApiError
                      ? mutation.error.message
                      : 'Falha ao enviar o cadastro. Tente novamente.'}
                  </div>
                )}

                <button className="btn-primary w-full text-lg" disabled={mutation.isPending}>
                  {mutation.isPending ? (
                    'Enviando...'
                  ) : (
                    <>
                      Criar minha loja <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>

                <p className="text-center text-sm text-slate-500">
                  Já tem uma conta?{' '}
                  <Link to="/login" className="font-semibold text-brand-700 hover:underline">
                    Entrar
                  </Link>
                </p>
              </form>
            </>
          )}
        </div>
      </main>

      {/* Modais de documentos legais — abrem por cima do formulário sem
          desmontá-lo; ao fechar, tudo que já foi digitado continua intacto
          (nenhum estado do RHF é tocado por esses modais). */}
      {showTerms && (
        <LegalDocumentModal title="Termos de Uso" icon={FileText} onClose={() => setShowTerms(false)}>
          <TermsOfUseContent />
        </LegalDocumentModal>
      )}
      {showPrivacy && (
        <LegalDocumentModal
          title="Política de Privacidade (LGPD)"
          icon={ShieldCheck}
          onClose={() => setShowPrivacy(false)}
        >
          <PrivacyPolicyContent />
        </LegalDocumentModal>
      )}
    </div>
  );
}
