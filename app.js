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
  // console.log('req.body', req.body);

  try {
    const { text, html, from, attachments, subject } = req.body;

    // Convert attachments if they exist and are an array
    const convertedAttachments =
      req.files && Array.isArray(req.files)
        ? req.files.map((file) => {
            const { originalname, buffer, mimetype } = file;
            return {
              filename: originalname,
              content: buffer.toString('base64'),
              contentType: mimetype,
              contentId: file.fieldname.replace('attachment', ''), // Update the contentId property
            };
          })
        : [];

    const msg = {
      to: 'nightOwlNico@gmail.com',
      from: 'email-forwarding-handler@NightOwlNico.com', // Use the verified 'from' address
    };

    if (from) {
      msg.replyTo = from; // Set the 'reply-to' field to the original sender's email address
    }

    if (text && !html) {
      msg.text = text;
    }

    if (html) {
      let updatedHtml = html;
      // Update CID references in the HTML body
      convertedAttachments.forEach((attachment) => {
        const { contentId } = attachment;
        const cidRegex = new RegExp(`cid:${contentId}`, 'g');
        updatedHtml = updatedHtml.replace(
          cidRegex,
          `cid:${attachment.filename}`
        );
      });
      msg.html = `Original sender: ${from.address}<br/><br/>${updatedHtml}`;
    }

    if (convertedAttachments.length > 0) {
      msg.attachments = convertedAttachments;
    }

    if (subject) {
      msg.subject = subject;
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
