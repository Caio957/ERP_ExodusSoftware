import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🦅 Iniciando Operação de Extração do Super Admin...')

  // BLINDAGEM: Lê o e-mail diretamente da variável de ambiente do servidor. Zero hardcode!
  const devEmail = process.env.SUPER_ADMIN_EMAIL
  
  if (!devEmail) {
    console.error('❌ Variável SUPER_ADMIN_EMAIL não está configurada no ambiente!')
    process.exit(1)
  }
  
  // 1. Localizar o seu usuário
  const devUser = await prisma.user.findFirst({
    where: { email: devEmail }
  })

  if (!devUser) {
    console.error(`❌ Usuário desenvolvedor (${devEmail}) não encontrado no banco!`)
    process.exit(1)
  }

  console.log(`🔍 Usuário encontrado: ${devUser.email} (Empresa Atual: ${devUser.companyId})`)

  // 2. Criar a empresa Exodus (Sede)
  const hqCompany = await prisma.company.create({
    data: {
      name: 'Exodus Software (Sede)',
      status: 'ACTIVE', // Já nasce liberado
    }
  })
  console.log(`✅ Nova Empresa 'Exodus Software (Sede)' criada com ID: ${hqCompany.id}`)

  // 3. Transferir o usuário desenvolvedor para a nova empresa
  await prisma.user.update({
    where: { id: devUser.id },
    data: { companyId: hqCompany.id }
  })
  
  console.log(`✅ Usuário transferido com sucesso para a Sede!`)
  console.log('🎯 Operação concluída. O isolamento foi estabelecido.')
}

main()
  .catch((e) => {
    console.error('❌ Falha na operação:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })