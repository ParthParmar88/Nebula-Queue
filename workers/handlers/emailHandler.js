const nodemailer = require('nodemailer')

// Create reusable transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS   // Gmail App Password (not your real password)
  }
})

async function handleEmailSend(job) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error(
      'EMAIL_USER and EMAIL_PASS are not set on the worker (Gmail app password required for EMAIL_SEND)'
    )
  }

  if (!job.payload) {
    throw new Error('EMAIL_SEND requires a JSON payload: {"to":"...","subject":"...","body":"..."}')
  }

  // payload example: { "to": "someone@gmail.com", "subject": "Hello", "body": "Hi there!" }
  let payload
  try {
    payload = JSON.parse(job.payload)
  } catch {
    throw new Error('EMAIL_SEND payload must be valid JSON')
  }

  const { to, subject, body } = payload

  if (!to || !subject || !body) {
    throw new Error('Missing required fields: to, subject, body')
  }

  const mailOptions = {
    from: `"Nebula Queue" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #3b82f6;">📬 Message from Nebula Queue</h2>
        <p>${body}</p>
        <hr/>
        <small style="color: #9ca3af;">Sent via Nebula Queue System</small>
      </div>
    `
  }

  const info = await transporter.sendMail(mailOptions)
  console.log(`📧 Email sent to ${to} | MessageID: ${info.messageId}`)

  // Return result so it can be saved as resultUrl in DB
  return `Email delivered to ${to} at ${new Date().toISOString()}`
}

module.exports = { handleEmailSend }