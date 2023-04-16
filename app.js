const express = require('express');
const multer = require('multer');
const sgMail = require('@sendgrid/mail');

const app = express();
const port = process.env.PORT || 3000;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.post('/sendgrid-webhook', upload.any(), async (req, res) => {
  // console.log('req.body', req.body);

  if (!req.body.from) {
    return res.status(400).send('Missing required field: from');
  }

  const emailData = req.body;
  const fromEmail = emailData.from;
  const subject = emailData.subject;
  const textContent = emailData.text;
  const htmlContent = emailData.html;

  console.log('Text content:', textContent);
  console.log('HTML content:', htmlContent);

  // Process attachments
  const attachments = req.files.map((file) => {
    return {
      content: file.buffer.toString('base64'),
      filename: file.originalname,
      type: file.mimetype,
      disposition: 'attachment',
    };
  });

  // Create and send email using SendGrid
  const msg = {
    to: process.env.TO_EMAIL,
    from: process.env.FROM_EMAIL,
    replyTo: fromEmail,
    subject: subject,
    text: textContent,
    html: htmlContent,
    attachments: attachments,
  };

  // console.log('Sending message:', msg);

  try {
    await sgMail.send(msg);
    res.status(200).send('Email forwarded successfully');
  } catch (error) {
    console.error('Error:', error);
    if (error.response && error.response.body) {
      console.error('Error response body:', error.response.body);
    }
    res.status(500).send('Error forwarding email');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
