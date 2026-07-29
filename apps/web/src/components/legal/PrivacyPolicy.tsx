import { AlertTriangle } from 'lucide-react';
import { LegalSection } from './LegalSection';

/**
 * Política de Privacidade — documento-base (draft) exibido no onboarding
 * público. Assim como `TermsOfUse.tsx`, é um texto genérico plausível, não
 * um documento jurídico validado. Alguns pontos (ex.: criptografia de dados
 * sensíveis) refletem controles que o próprio backend já implementa de
 * verdade (`lib/encryption.ts`) — o restante é um esqueleto padrão de
 * política LGPD que precisa ser revisado por um advogado antes de uso real.
 */
export function PrivacyPolicyContent() {
  return (
    <div>
      <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        Documento-base gerado para fins de desenvolvimento do produto. Ainda não passou por revisão
        jurídica e não deve ser considerado vinculante até validação de um advogado.
      </div>

      <p className="mb-5 text-xs text-slate-400">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

      <LegalSection title="1. Controlador dos Dados">
        <p>
          Para os fins da Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — "LGPD"), a Exodus Software
          é a controladora dos dados pessoais coletados no momento do cadastro da empresa (dados do
          lojista e do responsável pela conta). Para os dados de clientes e fornecedores que o Contratante
          insere na Plataforma durante o uso do sistema, o Contratante figura como controlador desses
          dados, e a Exodus atua como operadora.
        </p>
      </LegalSection>

      <LegalSection title="2. Dados Pessoais Coletados">
        <p>Coletamos, no cadastro público de uma nova loja: nome da empresa, CNPJ ou CPF, nome do
          responsável, e-mail e senha de acesso (armazenada com hash, nunca em texto plano).</p>
        <p>
          Durante o uso da Plataforma, o Contratante pode inserir dados de clientes e fornecedores (nome,
          documento, telefone, e-mail, endereço) para operação do sistema — esses dados sensíveis são
          armazenados de forma criptografada em repouso.
        </p>
      </LegalSection>

      <LegalSection title="3. Finalidade do Tratamento">
        <p>
          Os dados são tratados para: viabilizar o cadastro e a autenticação na Plataforma; permitir a
          triagem e aprovação de novas contas; possibilitar a prestação do serviço contratado (gestão de
          estoque, vendas, caixa, financeiro); e cumprir obrigações legais ou regulatórias aplicáveis.
        </p>
      </LegalSection>

      <LegalSection title="4. Base Legal">
        <p>
          O tratamento se fundamenta, conforme o caso, na execução de contrato ou de procedimentos
          preliminares a pedido do titular (art. 7º, V, LGPD), no cumprimento de obrigação legal (art. 7º,
          II), no legítimo interesse do controlador (art. 7º, IX) e, quando aplicável, no consentimento
          expresso do titular (art. 7º, I) — como o marcado neste formulário de cadastro.
        </p>
      </LegalSection>

      <LegalSection title="5. Compartilhamento de Dados">
        <p>
          Não vendemos dados pessoais a terceiros. Dados podem ser compartilhados com provedores de
          infraestrutura estritamente necessários à operação da Plataforma (ex.: provedor de hospedagem e
          banco de dados), sempre sob obrigações contratuais de confidencialidade e segurança, ou quando
          exigido por ordem judicial ou autoridade competente.
        </p>
      </LegalSection>

      <LegalSection title="6. Armazenamento e Segurança">
        <p>
          Adotamos medidas técnicas e administrativas para proteger os dados pessoais, incluindo
          criptografia de dados sensíveis em repouso, controle de acesso por perfil de usuário (RBAC),
          isolamento lógico entre empresas (tenants) e registro de auditoria para acessos administrativos
          excepcionais.
        </p>
      </LegalSection>

      <LegalSection title="7. Retenção e Eliminação">
        <p>
          Os dados são mantidos pelo tempo necessário ao cumprimento das finalidades para as quais foram
          coletados, ou pelo prazo exigido por obrigação legal. Mediante solicitação do titular, dados
          pessoais podem ser anonimizados, preservando-se o histórico de operações vinculado por
          identificador não identificável.
        </p>
      </LegalSection>

      <LegalSection title="8. Direitos do Titular">
        <p>Nos termos do art. 18 da LGPD, o titular dos dados pode solicitar, a qualquer momento:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Confirmação da existência de tratamento;</li>
          <li>Acesso aos dados;</li>
          <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;</li>
          <li>Portabilidade dos dados a outro fornecedor de serviço;</li>
          <li>Eliminação dos dados tratados com consentimento do titular;</li>
          <li>Revogação do consentimento a qualquer momento.</li>
        </ul>
      </LegalSection>

      <LegalSection title="9. Cookies e Tecnologias Semelhantes">
        <p>
          A Plataforma utiliza armazenamento local do navegador (ex.: token de sessão, cache para uso
          offline) estritamente necessário ao funcionamento do sistema, não para fins de publicidade ou
          rastreamento de terceiros.
        </p>
      </LegalSection>

      <LegalSection title="10. Encarregado de Dados (DPO)">
        <p>
          Solicitações relacionadas a dados pessoais podem ser encaminhadas ao Encarregado de Proteção de
          Dados da Exodus Software pelo canal de suporte oficial da Plataforma. (Contato específico do DPO
          a ser definido na versão final deste documento.)
        </p>
      </LegalSection>

      <LegalSection title="11. Alterações desta Política">
        <p>
          Esta Política pode ser atualizada periodicamente para refletir mudanças legais, técnicas ou
          operacionais. A versão vigente estará sempre disponível dentro da Plataforma.
        </p>
      </LegalSection>
    </div>
  );
}
