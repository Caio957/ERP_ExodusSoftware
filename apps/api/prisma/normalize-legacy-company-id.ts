import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'

const prisma = new PrismaClient()

// ID legado literal encontrado em produção ("Loja Matriz", cliente real
// cadastrado antes da padronização de Company.id para UUID). Hardcoded de
// propósito — este é um script cirúrgico para UMA linha específica, não um
// utilitário genérico para qualquer id malformado.
const OLD_COMPANY_ID = '0001'

const CONFIRMED = process.env.CONFIRM_MIGRATION === '1'

async function countAll(companyId: string) {
  return {
    User: await prisma.user.count({ where: { companyId } }),
    Product: await prisma.product.count({ where: { companyId } }),
    ProductVariant: await prisma.productVariant.count({ where: { companyId } }),
    Person: await prisma.person.count({ where: { companyId } }),
    Invoice: await prisma.invoice.count({ where: { companyId } }),
    InvoiceItem: await prisma.invoiceItem.count({ where: { companyId } }),
    SupplierProductMapping: await prisma.supplierProductMapping.count({ where: { companyId } }),
    CashRegister: await prisma.cashRegister.count({ where: { companyId } }),
    CashTransaction: await prisma.cashTransaction.count({ where: { companyId } }),
    Sale: await prisma.sale.count({ where: { companyId } }),
    SaleItem: await prisma.saleItem.count({ where: { companyId } }),
    SalePayment: await prisma.salePayment.count({ where: { companyId } }),
    StockMovement: await prisma.stockMovement.count({ where: { companyId } }),
    Setting: await prisma.setting.count({ where: { companyId } }),
    FinancialAccount: await prisma.financialAccount.count({ where: { companyId } }),
    AccountSettlement: await prisma.accountSettlement.count({ where: { companyId } }),
  }
}

async function main() {
  console.log('🔧 Normalização do Company.id legado (retrocompatibilidade segura)')
  console.log(`   Alvo: Company.id = "${OLD_COMPANY_ID}"`)
  console.log(`   Modo: ${CONFIRMED ? '⚠️  CONFIRMADO — vai escrever no banco' : '🧪 dry-run (nada será alterado)'}`)
  console.log('')

  const oldCompany = await prisma.company.findUnique({ where: { id: OLD_COMPANY_ID } })

  if (!oldCompany) {
    console.log(`✅ Nenhuma empresa com id "${OLD_COMPANY_ID}" encontrada — nada a fazer (já migrada ou nunca existiu).`)
    return
  }

  console.log(`🔍 Empresa encontrada: "${oldCompany.name}" (status ${oldCompany.status}, criada em ${oldCompany.createdAt.toISOString()})`)

  const before = await countAll(OLD_COMPANY_ID)
  console.log('📊 Linhas vinculadas hoje (companyId = "0001"):')
  console.table(before)

  const auditLogBefore = await prisma.auditLog.count({ where: { targetCompanyId: OLD_COMPANY_ID } })
  if (auditLogBefore > 0) {
    console.log(`   (+ ${auditLogBefore} registro(s) em AuditLog.targetCompanyId — sem FK, atualizados por completude)`)
  }

  if (!CONFIRMED) {
    console.log('')
    console.log('🧪 DRY-RUN: nada foi escrito. Rode de novo com CONFIRM_MIGRATION=1 para aplicar de verdade.')
    return
  }

  const newId = randomUUID()
  console.log('')
  console.log(`🎯 Novo id gerado: ${newId}`)

  await prisma.$transaction(async (tx) => {
    // 1) Cria a empresa nova com o UUID novo, preservando os dados originais
    //    (inclusive createdAt — a data real de cadastro da cliente).
    await tx.company.create({
      data: {
        id: newId,
        name: oldCompany.name,
        document: oldCompany.document,
        status: oldCompany.status,
        createdAt: oldCompany.createdAt,
      },
    })

    // 2) Move cada tabela filha da empresa antiga para a nova — nesta ordem
    //    (depois de criar a empresa nova, antes de apagar a antiga) para
    //    nunca violar a FK (`onDelete: Restrict`) em nenhum momento.
    await tx.user.updateMany({ where: { companyId: OLD_COMPANY_ID }, data: { companyId: newId } })
    await tx.product.updateMany({ where: { companyId: OLD_COMPANY_ID }, data: { companyId: newId } })
    await tx.productVariant.updateMany({ where: { companyId: OLD_COMPANY_ID }, data: { companyId: newId } })
    await tx.person.updateMany({ where: { companyId: OLD_COMPANY_ID }, data: { companyId: newId } })
    await tx.invoice.updateMany({ where: { companyId: OLD_COMPANY_ID }, data: { companyId: newId } })
    await tx.invoiceItem.updateMany({ where: { companyId: OLD_COMPANY_ID }, data: { companyId: newId } })
    await tx.supplierProductMapping.updateMany({ where: { companyId: OLD_COMPANY_ID }, data: { companyId: newId } })
    await tx.cashRegister.updateMany({ where: { companyId: OLD_COMPANY_ID }, data: { companyId: newId } })
    await tx.cashTransaction.updateMany({ where: { companyId: OLD_COMPANY_ID }, data: { companyId: newId } })
    await tx.sale.updateMany({ where: { companyId: OLD_COMPANY_ID }, data: { companyId: newId } })
    await tx.saleItem.updateMany({ where: { companyId: OLD_COMPANY_ID }, data: { companyId: newId } })
    await tx.salePayment.updateMany({ where: { companyId: OLD_COMPANY_ID }, data: { companyId: newId } })
    await tx.stockMovement.updateMany({ where: { companyId: OLD_COMPANY_ID }, data: { companyId: newId } })
    await tx.setting.updateMany({ where: { companyId: OLD_COMPANY_ID }, data: { companyId: newId } })
    await tx.financialAccount.updateMany({ where: { companyId: OLD_COMPANY_ID }, data: { companyId: newId } })
    await tx.accountSettlement.updateMany({ where: { companyId: OLD_COMPANY_ID }, data: { companyId: newId } })

    // 2b) AuditLog não tem FK (é global, sobrevive à exclusão do que
    //     referencia) — atualizado por completude do histórico, mas não é
    //     requisito de integridade referencial.
    await tx.auditLog.updateMany({ where: { targetCompanyId: OLD_COMPANY_ID }, data: { targetCompanyId: newId } })

    // 3) Só agora é seguro apagar a empresa antiga — nenhuma linha mais
    //    referencia "0001".
    await tx.company.delete({ where: { id: OLD_COMPANY_ID } })
  })

  console.log('✅ Transação concluída.')

  const after = await countAll(newId)
  console.log('📊 Linhas vinculadas agora (companyId = novo UUID):')
  console.table(after)

  const mismatches = (Object.keys(before) as (keyof typeof before)[]).filter((k) => before[k] !== after[k])
  if (mismatches.length > 0) {
    console.error('❌ DIVERGÊNCIA nas contagens — investigar antes de confiar no resultado:', mismatches)
    process.exit(1)
  }

  const stillOld = await prisma.company.findUnique({ where: { id: OLD_COMPANY_ID } })
  const nowNew = await prisma.company.findUnique({ where: { id: newId } })
  console.log(`🔎 Verificação final: id antigo ainda existe? ${!!stillOld} · id novo existe? ${!!nowNew}`)
  console.log('🎯 Operação concluída com sucesso. O isolamento de UUID foi restaurado, nenhum dado foi perdido.')
}

main()
  .catch((e) => {
    console.error('❌ Falha na operação:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
