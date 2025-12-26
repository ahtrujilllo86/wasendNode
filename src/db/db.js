const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Opcional: Función para verificar la conexión al arrancar
const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Conexión a la base de datos establecida con Prisma');
  } catch (error) {
    console.error('❌ Error al conectar a la base de datos:', error);
    process.exit(1);
  }
};

module.exports = { prisma, connectDB };