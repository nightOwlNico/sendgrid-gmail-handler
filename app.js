require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { simpleParser } = require('mailparser');
const sgMail = require('@sendgrid/mail');

const app = express();
const port = process.env.PORT || 3000;

const rawPayloadStorage = multer.memoryStorage();
const rawPayloadUpload = multer({
  storage: rawPayloadStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // Set the size limit to 50 MB
}).single('email');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Extract and process data URI images
function processDataUriImages(html) {
  const dataUriRegex =
    /<img[^>]*src="data:image\/(jpeg|jpg|png|gif|bmp|webp|tif|tiff|svg|ico|avif|heic|heif);base64,([^"]*)"[^>]*>/gi;
  let updatedHtml = html;
  let match;

  while ((match = dataUriRegex.exec(html)) !== null) {
    const mimeType = `image/${match[1].toLowerCase()}`;
    const dataUri = match[0];
    const base64Data = match[2];
    const contentId = `datauri${dataUriRegex.lastIndex}`;

    const attachmentObject = {
      content: base64Data,
      filename: `${contentId}.${match[1].toLowerCase()}`,
      type: mimeType,
      disposition: 'inline',
      cid: contentId,
    };

    attachments.push(attachmentObject);

    const imgTagWithCid = dataUri.replace(
      /src="[^"]*"/,
      `src="cid:${contentId}"`
    );
    updatedHtml = updatedHtml.replace(dataUri, imgTagWithCid);
  }

  return updatedHtml;
}

app.post('/sendgrid-webhook', rawPayloadUpload, async (req, res) => {
  // console.log('req.body', req.body);

  try {
    if (!req.file) {
      return res.status(400).send('Missing raw email payload');
    }

    const rawEmail = req.file.buffer.toString('utf-8');
    const parsedEmail = await simpleParser(rawEmail);

    const { from, subject, text, html, attachments } = parsedEmail;

    if (!from) {
      return res.status(400).send('Missing required field: from');
    }

    const parsedSubject =
      from.value[0].address + ': ' + (subject || '(No Subject)');
    const parsedText = text || '';
    const parsedHtml = html || '';

    const updatedHtml = processDataUriImages(parsedHtml);
    const msg = {
      to: process.env.TO_EMAIL,
      from: process.env.FROM_EMAIL,
      replyTo: from.value[0].address,
      subject: parsedSubject,
      text: parsedText,
      html: updatedHtml,
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
    res.status(500).send(`Error forwarding email: ${error.message}`);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
