require('dotenv').config();
const express = require('express');
const multer = require('multer');
const sgMail = require('@sendgrid/mail');
const { Mail } = require('@sendgrid/helpers/classes');
const cheerio = require('cheerio');

const app = express();
const port = process.env.PORT || 3000;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

function isHtmlEmpty(html) {
  const $ = cheerio.load(html);

  const textContent = $.text().trim();
  const elementsToCheck = [
    'img',
    'a',
    'ul',
    'ol',
    'table',
    'form',
    'video',
    'audio',
    'iframe',
    'style',
    'script',
    'pre',
    'blockquote',
    'canvas',
    'svg',
    'object',
  ];

  let hasElements = false;

  for (const tagName of elementsToCheck) {
    if ($(tagName).length > 0) {
      hasElements = true;
      break;
    }
  }

  return !hasElements && textContent === '';
}

app.post('/sendgrid-webhook', upload.any(), async (req, res) => {
  console.log('req.body', req.body);

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

    const msg = new Mail();
    msg.setFrom(process.env.FROM_EMAIL);
    msg.setReplyTo(from);
    msg.addTo(process.env.TO_EMAIL);
    msg.setSubject(subject ? `${from}: ${subject}` : `${from}: (No Subject)`);

    if (text && text.trim() !== '') {
      msg.addTextContent(`Original message from ${from}:\n\n${text}`);
    }

    if (html && !isHtmlEmpty(html)) {
      msg.addHtmlContent(`Original message from ${from}:<br/><br/>${html}`);
    }

    if (req.files && req.files.length > 0) {
      const parsedAttachmentInfo = JSON.parse(attachmentInfo);

      req.files.forEach((file) => {
        const contentId = parsedAttachmentInfo[file.fieldname]['content-id'];
        const attachment = {
          content: file.buffer.toString('base64'),
          filename: file.originalname,
          type: file.mimetype,
          content_id: contentId,
        };

        // Set the disposition to inline if the contentId is used in the HTML content
        if (html && html.includes(`cid:${contentId}`)) {
          attachment.disposition = 'inline';
        } else {
          attachment.disposition = 'attachment';
        }

        msg.addAttachment(attachment);
      });
    }

    console.log('Sending message:', msg.toJSON());

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
