require('dotenv').config();
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

  try {
    const { from, subject, text, html } = req.body;

    const msg = {
      to: 'nightOwlNico@gmail.com',
      from: 'email-forwarding-handler@NightOwlNico.com',
    };

    if (from) {
      msg.replyTo = from; // Set the 'reply-to' field to the original sender's email address
    }

    if (subject) {
      msg.subject = subject;
    }

    if (text) {
      msg.text = text;
    }

    if (html) {
      msg.html = html;
    }

    if (attachments) {
      msg.attachments = attachments;
    }

    // console.log('Sending message:', msg);

    await sgMail.send(msg);
    res.status(200).send('Email forwarded successfully');
  } catch (error) {
    console.error('Error:', error);
    if (error.response) {
      console.error('Error response body:', error.response.body);
    }
    res.status(500).send('Error forwarding email');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
