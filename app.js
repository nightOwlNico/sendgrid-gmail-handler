require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const sgMail = require('@sendgrid/mail');

const app = express();
const port = process.env.PORT || 3000;
app.use(bodyParser.json());

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.post('/sendgrid-webhook', async (req, res) => {
  console.log(req.body);
  try {
    const { to, from, subject, text, html, attachments } = req.body;

    // Convert attachments if they exist and are an array
    const convertedAttachments =
      attachments && Array.isArray(attachments)
        ? attachments.map((attachment) => {
            const { filename, content, contentType } = attachment;
            return {
              filename,
              content: Buffer.from(content, 'base64'),
              contentType,
            };
          })
        : [];

    const msg = {
      to: 'nightOwlNico@gmail.com',
      from: 'Nico@NightOwlNico.com', // Use the verified 'from' address
      replyTo: from.address, // Set the 'reply-to' field to the original sender's email address
      subject: `Forwarded: ${subject}`,
      text: `Original sender: ${from.address}\n\n${text}`,
      html: `Original sender: ${from.address}<br/><br/>${html}`,
      attachments: convertedAttachments,
    };

    console.log('Sending message:', msg);

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
