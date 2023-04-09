require('dotenv').config();
const express = require('express');
const multer = require('multer');
const sgMail = require('@sendgrid/mail');

const app = express();
const port = process.env.PORT || 3000;
// const upload = multer();
// app.use(upload.any());
// ----------
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
// ----------

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const convertToBase64 = (buffer) => {
  return buffer.toString('base64');
};

// ----------
app.post('/sendgrid-webhook', upload.any(), async (req, res) => {
  // console.log('req.body', req.body);

  try {
    const { from, subject, text, html } = req.body;
    const numAttachments = parseInt(req.body.attachments, 10);
    const attachmentInfo = JSON.parse(req.body['attachment-info']);

    // Extract content-ids mapping
    const contentIdsMapping = JSON.parse(req.body['content-ids']);

    let attachments = [];
    let embeddedImages = [];
    for (let i = 1; i <= numAttachments; i++) {
      const attachment = req.files.find(
        (file) => file.fieldname === `attachment${i}`
      );
      const info = attachmentInfo[`attachment${i}`];

      const attachmentData = {
        content: convertToBase64(attachment.buffer),
        filename: info.filename,
        contentType: info.type,
        contentId: info['content-id'] || undefined,
      };

      if (info.type.startsWith('image/')) {
        attachmentData.contentId = info['content-id'] || `inlineImage${i}`;
        embeddedImages.push(
          `<img src="cid:${attachmentData.contentId}" alt="${info.filename}" />`
        );
      }

      attachments.push(attachmentData);
    }

    const msg = {
      to: 'nightOwlNico@gmail.com',
      from: 'email-forwarding-handler@NightOwlNico.com',
    };

    if (from) {
      msg.replyTo = from;
    }

    if (subject) {
      msg.subject = subject;
    }

    if (text && !html) {
      msg.text = text;
    }

    if (html) {
      msg.html = html + embeddedImages.join('\n');
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
// ----------

// ==========
// app.post('/sendgrid-webhook', async (req, res) => {
//   // console.log('req.body', req.body);

//   try {
//     const { text, html, from, subject, attachments, attachmentInfo } = req.body;
//     const attachmentInfoObj = JSON.parse(attachmentInfo || '{}');
//     const receivedAttachments = [];

//     if (attachments) {
//       for (let i = 1; i <= parseInt(attachments, 10); i++) {
//         const attachmentField = `attachment${i}`;
//         const attachmentFile = req.files.find(
//           (file) => file.fieldname === attachmentField
//         );

//         if (
//           attachmentFile &&
//           attachmentInfoObj[attachmentField] &&
//           attachmentInfoObj[attachmentField]['content-id']
//         ) {
//           receivedAttachments.push({
//             contentId: attachmentInfoObj[attachmentField]['content-id'],
//             contentType: attachmentFile.mimetype,
//             filename: attachmentFile.originalname,
//             content: attachmentFile.buffer.toString('base64'),
//           });
//         }
//       }
//     }

//     const convertedAttachments = receivedAttachments.map((attachment) => {
//       const { filename, content, contentType, contentId } = attachment;

//       return {
//         filename,
//         content,
//         contentType,
//         contentId,
//         disposition: 'inline',
//         headers: { 'Content-ID': `<${contentId}>` },
//       };
//     });

//     const msg = {
//       to: 'nightOwlNico@gmail.com',
//       from: 'email-forwarding-handler@NightOwlNico.com',
//     };

//     if (from) {
//       msg.replyTo = from; // Set the 'reply-to' field to the original sender's email address
//     }

//     if (text && !html) {
//       msg.text = text;
//     }

//     if (html) {
//       let updatedHtml = html;
//       convertedAttachments.forEach((attachment) => {
//         const { contentId } = attachment;
//         const cidRegex = new RegExp(`cid:${contentId}`, 'g');
//         updatedHtml = updatedHtml.replace(cidRegex, `cid:${contentId}`);
//       });
//       msg.html = updatedHtml;
//     }

//     if (convertedAttachments.length > 0) {
//       msg.attachments = convertedAttachments;
//     }

//     if (subject) {
//       msg.subject = subject;
//     }

//     // console.log('Sending message:', msg);

//   await sgMail.send(msg);
//   res.status(200).send('Email forwarded successfully');
// } catch (error) {
//   console.error('Error:', error);
//   if (error.response) {
//     console.error('Error response body:', error.response.body);
//   }
//   res.status(500).send('Error forwarding email');
// }
// });
// ==========

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
