require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const sgMail = require('@sendgrid/mail');

const app = express();
app.use(bodyParser.json());

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.post('/sendgrid-webhook', async (req, res) => {
  try {
    const { to, from, subject, text } = req.body;
    const msg = {
      to: 'nightOwlNico@gmail.com',
      from: from.email,
      subject: `Forwarded: ${subject}`,
      text: `Original sender: ${from.email}\n\n${text}`,
    };

    await sgMail.send(msg);
    res.status(200).send('Email forwarded successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error forwarding email');
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));
