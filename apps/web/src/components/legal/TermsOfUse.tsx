import { AlertTriangle } from 'lucide-react';
import { LegalSection } from './LegalSection';

/**
 * Termos de Uso — documento-base (draft) exibido no onboarding público.
 * Texto genérico de SaaS, escrito para ser plausível e profissional, mas
 * **não é um documento jurídico validado** — precisa de revisão de um
 * advogado antes de qualquer uso real em produção (ver aviso no topo do
 * próprio conteúdo, sempre visível para quem lê).
 */
export function TermsOfUseContent() {
  return (
    <div>
      <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        Documento-base gerado para fins de desenvolvimento do produto. Ainda não passou por revisão
        jurídica e não deve ser considerado vinculante até validação de um advogado.
      </div>

      <p className="mb-5 text-xs text-slate-400">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

      <LegalSection title="1. Aceitação dos Termos">
        <p>
          Ao criar uma conta e utilizar o Exodus ERP ("Plataforma", "Serviço"), você ("Contratante",
          "Usuário") declara ter lido, compreendido e concordado integralmente com estes Termos de Uso.
          Caso não concorde com qualquer disposição aqui prevista, não utilize a Plataforma.
        </p>
      </LegalSection>

      <LegalSection title="2. Descrição do Serviço">
        <p>
          O Exodus ERP é um software de gestão comercial oferecido no modelo Software como Serviço
          (SaaS), voltado a lojas de cosméticos e varejo de beleza, contemplando módulos de controle de
          estoque, ponto de venda (PDV), caixa, compras, financeiro e cadastros correlatos.
        </p>
      </LegalSection>

      <LegalSection title="3. Cadastro e Aprovação da Conta">
        <p>
          O cadastro realizado por este formulário cria uma empresa (tenant) com status pendente de
          análise. O acesso à Plataforma somente é liberado após triagem manual pela equipe Exodus, que
          pode aprovar, recusar ou solicitar informações adicionais antes da liberação, a seu exclusivo
          critério.
        </p>
        <p>
          O Contratante é responsável por manter a veracidade, exatidão e atualização dos dados
          informados no cadastro, incluindo CNPJ/CPF, e-mail e demais dados do responsável pela conta.
        </p>
      </LegalSection>

      <LegalSection title="4. Obrigações do Usuário">
        <p>
          O Usuário compromete-se a: (i) utilizar a Plataforma exclusivamente para finalidades lícitas;
          (ii) não tentar acessar dados de outras empresas cadastradas na Plataforma; (iii) manter em
          sigilo suas credenciais de acesso; (iv) notificar a Exodus imediatamente em caso de suspeita de
          uso não autorizado de sua conta.
        </p>
      </LegalSection>

      <LegalSection title="5. Dados Inseridos pelo Contratante">
        <p>
          O Contratante é o único responsável pela exatidão, licitude e adequação legal dos dados de
          clientes, fornecedores, produtos e operações que inserir na Plataforma, incluindo o cumprimento
          de suas próprias obrigações como controlador desses dados perante a Lei Geral de Proteção de
          Dados (Lei nº 13.709/2018).
        </p>
      </LegalSection>

      <LegalSection title="6. Planos, Cobrança e Cancelamento">
        <p>
          As condições comerciais (mensalidade, formas de pagamento e política de cancelamento) serão
          informadas separadamente no momento da contratação comercial e não são objeto detalhado deste
          documento-base.
        </p>
      </LegalSection>

      <LegalSection title="7. Propriedade Intelectual">
        <p>
          Todo o código-fonte, marca, layout, identidade visual e demais elementos da Plataforma são de
          propriedade exclusiva da Exodus Software ou de seus licenciantes, sendo vedada sua reprodução,
          engenharia reversa ou distribuição sem autorização prévia e expressa.
        </p>
      </LegalSection>

      <LegalSection title="8. Disponibilidade e Suporte">
        <p>
          A Exodus envida seus melhores esforços para manter a Plataforma disponível de forma contínua,
          mas não garante disponibilidade ininterrupta, podendo ocorrer indisponibilidades programadas
          (manutenção) ou eventuais falhas técnicas.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitação de Responsabilidade">
        <p>
          Na máxima extensão permitida pela legislação aplicável, a Exodus não se responsabiliza por
          lucros cessantes, perda de dados decorrente de uso indevido da Plataforma pelo próprio
          Contratante, ou por decisões comerciais tomadas com base nas informações geradas pelo sistema.
        </p>
      </LegalSection>

      <LegalSection title="10. Suspensão e Encerramento">
        <p>
          A Exodus reserva-se o direito de suspender ou encerrar contas que violem estes Termos, que
          apresentem indícios de fraude, ou mediante inadimplência, respeitado o devido aviso prévio
          quando aplicável.
        </p>
      </LegalSection>

      <LegalSection title="11. Alterações destes Termos">
        <p>
          Estes Termos podem ser atualizados periodicamente. Alterações materiais serão comunicadas aos
          usuários com antecedência razoável pelos canais de contato cadastrados.
        </p>
      </LegalSection>

      <LegalSection title="12. Legislação Aplicável e Foro">
        <p>
          Estes Termos são regidos pelas leis da República Federativa do Brasil, elegendo-se o foro da
          comarca sede da Exodus Software para dirimir eventuais controvérsias, com renúncia a qualquer
          outro, por mais privilegiado que seja.
        </p>
      </LegalSection>
    </div>
  );
}
