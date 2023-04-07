require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const sgMail = require('@sendgrid/mail');

const app = express();
const port = process.env.PORT || 3000;
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
