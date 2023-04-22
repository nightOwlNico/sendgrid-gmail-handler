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
    const {
      from,
      subject,
      text,
      html,
      'attachment-info': attachmentInfo,
    } = req.body;
    let attachments = [];
    let updatedHtml = html;

    if (!from) {
      return res.status(400).send('Missing required field: from');
    }

    if (req.files && req.files.length > 0) {
      // Parse the attachment-info JSON string
      const parsedAttachmentInfo = JSON.parse(attachmentInfo);

      // Create an array of attachments with the required format
      attachments = req.files.map((file) => {
        const contentId = parsedAttachmentInfo[file.fieldname]['content-id'];

        // Update the HTML content with the correct Content-ID
        const regex = new RegExp(`cid:${file.fieldname}`, 'g');
        updatedHtml = updatedHtml.replace(regex, `cid:${contentId}`);

        return {
          content: file.buffer.toString('base64'),
          filename: file.originalname,
          type: file.mimetype,
          disposition: 'attachment',
          contentId: contentId,
        };
      });
    }

    const msg = {
      to: process.env.TO_EMAIL,
      from: process.env.FROM_EMAIL,
      replyTo: from,
      subject: subject ? `${from}: ${subject}` : `${from}: (No Subject)`,
      text: text
        ? `Original sender: ${from}\n\n${text}`
        : `Original sender: ${from}\n\nNo text content provided.`,
      attachments: attachments,
    };

    // Add the HTML field only if there is HTML content available
    if (html) {
      msg.html = `Original sender: ${from}<br/><br/>${updatedHtml}`;
    }

    // console.log('Sending message:', msg);

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
