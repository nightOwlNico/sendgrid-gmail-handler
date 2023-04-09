require('dotenv').config();
const express = require('express');
const multer = require('multer');
const sgMail = require('@sendgrid/mail');

const app = express();
const port = process.env.PORT || 3000;
const upload = multer();
app.use(upload.any());

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.post('/sendgrid-webhook', async (req, res) => {
  try {
    // ==========
    const { to, text, html, from, envelope, attachments, subject } = req.body;

    // Convert attachments if they exist and are an array
    const convertedAttachments =
      attachments && Array.isArray(attachments)
        ? attachments.map((attachment) => {
            const { originalname, buffer, mimetype } = attachment;
            return {
              filename: originalname,
              content: buffer.toString('base64'),
              contentType: mimetype,
            };
          })
        : [];

    const msg = {
      to: 'nightOwlNico@gmail.com',
      from: 'Nico@NightOwlNico.com', // Use the verified 'from' address
    };

    if (from) {
      msg.replyTo = from; // Set the 'reply-to' field to the original sender's email address
    }

    if (to) {
      msg.REALtoFIELD = to;
    }

    if (text) {
      msg.text = text;
    }

    if (html) {
      msg.html = html;
    }

    if (from) {
      msg.REALfromFIELD = from;
    }

    if (envelope) {
      msg.envelope = envelope;
    }

    if (convertedAttachments.length > 0) {
      msg.attachments = convertedAttachments;
    }

    if (subject) {
      msg.subject = subject;
    }

    // ==========
    // const { from, subject, text, html, attachments } = req.body;

    // Convert attachments if they exist and are an array
    // const convertedAttachments =
    //   attachments && Array.isArray(attachments)
    //     ? attachments.map((attachment) => {
    //         const { originalname, buffer, mimetype } = attachment;
    //         return {
    //           filename: originalname,
    //           content: buffer.toString('base64'),
    //           contentType: mimetype,
    //         };
    //       })
    //     : [];

    // const msg = {
    //   to: 'nightOwlNico@gmail.com',
    //   from: 'Nico@NightOwlNico.com', // Use the verified 'from' address
    // };

    // if (from && from.address) {
    //   msg.replyTo = from.address; // Set the 'reply-to' field to the original sender's email address
    // }

    // msg.subject = subject ? `Forwarded: ${subject}` : 'Forwarded email';

    // if (!text) {
    //   msg.text = `Original sender: ${from.address}\n\nNo text content provided.`;
    // } else {
    //   msg.text = `Original sender: ${from.address}\n\n${text}`;
    // }

    // if (!html) {
    //   msg.html = `Original sender: ${from.address}<br/><br/>No HTML content provided.`;
    // } else {
    //   msg.html = `Original sender: ${from.address}<br/><br/>${html}`;
    // }

    // if (convertedAttachments.length > 0) {
    //   msg.attachments = convertedAttachments;
    // }

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
