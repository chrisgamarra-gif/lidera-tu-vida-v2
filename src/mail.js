'use strict';
const nodemailer = require('nodemailer');

const NAVY = '#0F2750';
const GOLD = '#B98A24';

let transporter = null;
let usingRealSmtp = false;

function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });
    usingRealSmtp = true;
  } else {
    // Modo de respaldo: no hay SMTP configurado. En vez de fallar o de no avisar
    // nada, dejamos constancia clara en los logs del servidor de qué correo se
    // habría enviado. Así el resto de la aplicación (y esta funcionalidad)
    // sigue funcionando aunque nadie haya configurado un proveedor de correo.
    transporter = { sendMail: async opts => {
      console.warn(
        '\n✉ SMTP no configurado (falta SMTP_HOST en .env) — correo NO enviado, solo mostrado aquí:\n' +
        `  Para: ${opts.to}\n  Asunto: ${opts.subject}\n  ---\n${opts.text}\n---\n`
      );
      return { simulated: true };
    }};
    usingRealSmtp = false;
  }
  return transporter;
}

function wrapHtml(title, bodyHtml) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif; background:#F3F5F9; padding:24px;">
    <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:10px; overflow:hidden; border:1px solid #D9E0EA;">
      <div style="background:${NAVY}; padding:18px 24px;">
        <span style="color:#ffffff; font-weight:bold; font-size:16px;">GAMARRA LEADERSHIP</span>
        <div style="color:#C7D0DE; font-size:11px; letter-spacing:.06em; text-transform:uppercase; margin-top:2px;">Lidera tu Vida &middot; Plan de Crecimiento Personal</div>
      </div>
      <div style="padding:24px; color:#101B2C; font-size:14px; line-height:1.55;">
        <h2 style="font-size:18px; margin:0 0 12px; color:${NAVY};">${title}</h2>
        ${bodyHtml}
      </div>
      <div style="padding:14px 24px; background:#F3F5F9; color:#4C5A70; font-size:11px;">
        Este es un aviso automático del programa de mentoría Lidera tu Vida.
      </div>
    </div>
  </div>`;
}

/**
 * Envía el aviso de que una o más áreas de un participante pasaron a rojo.
 * @param {string[]} destinatarios  lista de correos (mentee + mentores)
 * @param {object}   info           { nombreParticipante, areasEnRojo: string[] }
 */
async function sendSemaforoRojoAlert(destinatarios, info) {
  const correos = (destinatarios || []).filter(Boolean);
  if (!correos.length) {
    console.warn(`✉ No hay correos configurados para avisar sobre ${info.nombreParticipante}; se omite el envío.`);
    return;
  }

  const listaAreas = info.areasEnRojo.map(a => `<li>${a}</li>`).join('');
  const subject = `Alerta: ${info.nombreParticipante} tiene ${info.areasEnRojo.length > 1 ? 'áreas' : 'un área'} en rojo`;
  const html = wrapHtml(
    'Semáforo en rojo',
    `<p><b>${info.nombreParticipante}</b> acaba de pasar a <b style="color:${'#B23B32'}">rojo</b> en:</p>
     <ul>${listaAreas}</ul>
     <p>Puede ser un buen momento para acercarte, revisar su plan y ofrecer acompañamiento.</p>`
  );
  const text =
    `${info.nombreParticipante} paso a rojo en: ${info.areasEnRojo.join(', ')}. ` +
    `Puede ser un buen momento para acercarte y ofrecer acompanamiento.`;

  const mailer = getTransporter();
  for (const to of correos) {
    try {
      await mailer.sendMail({
        from: process.env.SMTP_FROM || 'Lidera tu Vida <no-reply@lideratuvida.local>',
        to,
        subject,
        text,
        html
      });
    } catch (e) {
      // Un correo que falla no debe tumbar la petición HTTP que lo disparó.
      console.error(`✉ No se pudo enviar el aviso de semaforo a ${to}:`, e.message);
    }
  }
}

module.exports = { sendSemaforoRojoAlert, isUsingRealSmtp: () => usingRealSmtp };
