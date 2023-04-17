const express = require('express');
const multer = require('multer');
const sgMail = require('@sendgrid/mail');
const { simpleParser } = require('mailparser');

const app = express();
const port = process.env.PORT || 3000;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.post('/sendgrid-webhook', upload.any(), async (req, res) => {
  const rawEmail = req.body.raw; // Assuming the raw payload is sent in the 'raw' field
  const parsedEmail = await simpleParser(rawEmail);

  // Update the 'To' field in the header
  parsedEmail.to.value = [{ address: 'new_recipient@example.com', name: '' }];

  // Reconstruct the MIME message
  const rawPayload = parsedEmail.build();
  // Forward modified email using SendGrid
  const msg = {
    raw: rawPayload.toString('base64'), // Convert the Buffer to a base64 string
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
