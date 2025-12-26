import { PrismaClient } from "@prisma/client/extension";

const prisma = new PrismaClient();

async function main() {
  try {
    // Crear un usuario
    const user = await prisma.user.create({
      data: {
        name: 'Hola Podman ESM',
        email: `podman_${Date.now()}@prisma.io`, // Email único para evitar errores de duplicado
      },
    });
    console.log('✅ Usuario creado:', user);

    // Consultar todos los usuarios
    const allUsers = await prisma.user.findMany();
    console.log('📋 Todos los usuarios en la DB:', allUsers);
  } catch (error) {
    console.error('❌ Error en la ejecución:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();