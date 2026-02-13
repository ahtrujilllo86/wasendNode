import express from 'express'
import { sock, isConnected } from '../whatsapp/state.js'
import { askText } from '../ai/textRequests.js'
import { getContentType } from '@whiskeysockets/baileys';
import dotenv from 'dotenv'

dotenv.config()

const router = express.Router()

const getShortPhoneNumber = (number)=>{
  const fullNumber = number.split('@')[0];
  const shortPhoneNumer = fullNumber.slice(-10);
  return shortPhoneNumer;
};

/**
 * 
 * @param {*} messageFormatOutput 
 * Ejemplo: messageFormatOutput = {
    number,
    remoteName: message.pushName,
    message: text,
  }
 * @param {*} type 
 * Tipo de mensaje : INCOMING, OUTGOING
 */
async function saveMessage(messageFormatOutput, type) {
  const {message, number} = messageFormatOutput
  const originPhone = getShortPhoneNumber(number);

  const data = {
    message,
    type,
    originPhone,
  };

  fetch(`${process.env.URL_WA_DB}/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      'X-API-KEY': process.env.API_KEY_WA_DB
    },
    body: JSON.stringify(data)
  });
}

/**
 * Verifica si el numero que escribe esta autorizado para registrar tareas
 * @param {*} number 
 * @returns 
 */
async function getAuthUser(number) {
  const shortPhoneNumer = getShortPhoneNumber(number);

  try {
    const response = await fetch(
      `${process.env.URL_WA_DB}/users/auth/${shortPhoneNumer}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': process.env.API_KEY_WA_DB
        }
      }
    );
    const user = await response.json();
    return user;
  } catch (error) {
    console.error(error.message);
  }
}

/**
 * 
 * @param {*} messageFormatOutput 
 * Ejemplo: messageFormatOutput = {
    number,
    remoteName: message.pushName,
    message: text,
  }
 * @param {*} type 
 * Tipo de mensaje : INCOMING, OUTGOING
 * @param {*} delayMsg
 * Tiempo en milisegundos de retardo para enviar el mensaje
 */
async function saveAndProcessMessage(messageFormatOutput, type, delayMsg = 2500) {
  const { number } = messageFormatOutput;
  // guardamos el mensaje en DB
  await saveMessage(messageFormatOutput, type);
  // Marca el mensaje como leído para que no se vuelva a procesar
  await sock.readMessages([number]);
  // enviamos el mensaje al usuario
  await sendMessage(messageFormatOutput, delayMsg);
}

function getValidRemoteJid(data) {
  const { remoteJid, remoteJidAlt } = data;
  return [remoteJidAlt, remoteJid].find(jid =>
    /^\d+@s\.whatsapp\.net$/.test(jid)
  ) || null;
}

export async function handleIncomingMessages(msg) {
  const message = msg.messages[0]
  const number = getValidRemoteJid(message.key);
  const messageFormatOutput = {
    number,
    remoteName: message.pushName,
    message: '',
  }

  // Ignorar si es un mensaje que se envia desde la misma linea
  if (message.key.fromMe) return;

  const type = getContentType(message.message);

  if (type !== 'conversation' && type !== 'extendedTextMessage') {
    messageFormatOutput.message = '😢 ¡Ups! Solo acepto texto, no archivos, audio ni imagenes\nIntentamos de nuevo?';
    return  await saveMessage(messageFormatOutput, 'OUTGOING');;
  }

  // en este punto ya validamos que si existe un mensaje entrante
  const text =
  message.message.conversation ||
  message.message.extendedTextMessage?.text

  messageFormatOutput.message = text;

  // guardamos mensaje entrante antes de validar si esta autorizado
  await saveMessage(messageFormatOutput, 'INCOMING');

  const authUser = await getAuthUser(number);

  if (!authUser.success || number === null || !authUser.isActive) {
    console.log('numero no autorizado');
    messageFormatOutput.message = '😢 ¡Ups! Esta linea es solo para docentes\nSi tienes duda contacta a un administrador\n\n ¡Hasta pronto! 👋';
    
    return saveAndProcessMessage(messageFormatOutput, 'OUTGOING', 1500);
  }

  const courseId = authUser.users[0].courseId;
  // enviamos la frase a openAi
  const consultaAi = await consultarOpenAI(messageFormatOutput);
  const parsedResponse = JSON.parse(consultaAi)
  messageFormatOutput.message = parsedResponse.msg;

  // verificamos que la respuesta de openAi sea exitosa
  if (!parsedResponse.success) {
    return saveAndProcessMessage(messageFormatOutput, 'OUTGOING', 1500);
  }

  return await ejecutarPeticionClassroom(messageFormatOutput, parsedResponse, courseId)
}

/**
 * 
 * @param {*} messageFormatOutput 
 * Ejemplo: messageFormatOutput = {
    number,
    remoteName,
    message
  }
 */
async function ejecutarPeticionClassroom(messageFormatOutput, consultaAi, courseId) {
  // intentamos insertar la tarea en classroom
  const consultaApiClassroom = await insertarClassRoom(consultaAi, courseId);
  
  // mensaje final de confirmación exitosa
  messageFormatOutput.message = `Tarea creada con Exito!!\n\nPuedes revisar la tarea creada aqui 👇\n${consultaApiClassroom.alternateLink}`;

  // si regresa algun error, enviaremos el mensaje de error en lugar de exito
  if (consultaApiClassroom?.error) {
   messageFormatOutput.message = '¡Vaya! Ocurrio un error en el sistema al intentar crear la tarea 😅\n\nVuelve a intentar por favor';
  }

  await saveAndProcessMessage(messageFormatOutput, 'OUTGOING', 1500);
}


async function consultarOpenAI(messageFormatOutput) {
  const date = new Date();
  const prompt = `Eres un asesor académico digital encargado de registrar tareas escolares.Reglas estrictas:- El usuario escribe la tarea en lenguaje natural.- Extrae los parámetros sin pedir confirmación si la información es suficiente.- NO repitas la información al usuario.- NO pidas validación ni confirmación.- NO hagas preguntas si todos los campos pueden inferirse con claridad.- Solo pregunta cuando un dato sea imposible de inferir.Parámetros obligatorios:- title: materia (si no es clara, infierela del contenido)- group: grado y grupo ( si no esta en el prompt ajustalo a : general)- description: descripción de la tarea- limit: fecha límite de entrega en formato YYYY-MM-DD (si no hay una fecha clara, considera que hoy es ${date} y el limit consideralo 7 dias despues de hoy)Comportamiento:- Si TODOS los parámetros están disponibles, responde ÚNICAMENTE con un JSON válido.- Si FALTA algún parámetro, indicale que lo intente de nuevo, que le falta muy poco.-Maneja un tono amable y relajado con expresiones que le indiquen que va bien pero falta algo, con un enfoque juvenil y de preferencia maneja varios emojis para dar un toque de empatía  y maneja este formato de salida: {"success":false, "msg":sera la respuesta que elabores indicandole que intente de nuevo}.El Formato de salida cuando esté completo:{"success":true,"msg": algun mensaje que elabores indicandole que todo salio bien y que procederas a registrar la tarea,"title","group","description","limit"}.`;
  const { message } = messageFormatOutput;

  return await askText({system: prompt, user: message});
}

async function insertarClassRoom(consultaAi, courseId){
  let {title, group, description, limit} = consultaAi;
  let [year, month, day] = limit.split('-').map(Number);
  title = `${group}-${title}`;

try {
    const response = await fetch(`${process.env.URL_APP_CLASSROOM}/classroom/courses/${courseId}/coursework`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      description,
      maxPoints: 100,
      dueDate: {
        year,
        month,
        day
      },
      dueTime: {
        hours: 23,
        minutes: 59
      },
      workType: "ASSIGNMENT",
      state: "PUBLISHED"
    })
  });
  const data = await response.json();
  return data;
} catch (error) {
    console.log(error);
}  
}

async function sendMessage(messageFormatOutput, delay = 2500){
  const { number, message } = messageFormatOutput
  if (!sock || !isConnected)
    return res.json({ success: false, error: 'No conectado' })
  if (number) {
    const jid = number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`
    await new Promise(r => setTimeout(r, delay))
    await sock.sendMessage(number, { text: message })
  }
}

export default router
