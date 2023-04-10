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

    if (!from) {
      return res.status(400).send('Missing required field: from');
    }

    // Parse the attachment-info JSON string
    let parsedAttachmentInfo = {};

    try {
      parsedAttachmentInfo = JSON.parse(attachmentInfo);
    } catch (error) {
      console.error('Error parsing attachmentInfo:', error);
      return res.status(400).send('Invalid or missing attachmentInfo');
    }

    // Create an array of attachments with the required format
    const attachments = req.files.map((file) => {
      const fileInfo = parsedAttachmentInfo[file.fieldname];
      const contentId = fileInfo['content-id'];

      // Set disposition to 'inline' if the file is an image and contentId is present
      let disposition;
      if (file.mimetype.startsWith('image/')) {
        if (contentId) {
          disposition = 'inline';
        } else {
          disposition = fileInfo['disposition'];
          console.warn(
            'Warning: An inline image is missing contentId. Setting disposition to:',
            disposition
          );
        }
      } else {
        disposition = fileInfo['disposition'];
      }

      const attachment = {
        content: file.buffer.toString('base64'),
        filename: file.originalname,
        type: file.mimetype,
        disposition: disposition,
        contentId: contentId || undefined,
      };

      if (contentId) {
        attachment.contentId = contentId;
      }

      return attachment;
    });

    const msg = {
      to: process.env.TO_EMAIL,
      from: process.env.FROM_EMAIL,
      replyTo: from,
      subject: subject,
      text: text,
      html: html,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

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
