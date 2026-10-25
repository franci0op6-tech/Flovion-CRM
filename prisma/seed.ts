import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // 1. Criptiamo la password per sicurezza (usa pure 'admin123' per ora, potrai cambiarla)
  const hashedPassword = await bcrypt.hash('admin123', 10)

  // 2. Creiamo l'utente nel database
  const admin = await prisma.utente.upsert({
    where: { email: 'francesco@crm.it' },
    update: {},
    create: {
      nome: 'Francesco Errico',
      email: 'francesco@crm.it',
      password: hashedPassword,
      telegram_chat_id: '1205115934', // Il tuo ID Telegram già pronto!
    },
  })

  console.log('✅ Utente Admin creato con successo:', admin.email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })