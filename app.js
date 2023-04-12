require('dotenv').config();
const express = require('express');
const multer = require('multer');
const sgMail = require('@sendgrid/mail');

const app = express();
const port = process.env.PORT || 3000;
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Extract and process data URI images
function processDataUriImages(html) {
  const dataUriRegex =
    /<img[^>]*src="data:image\/(jpeg|jpg|png|gif|bmp|webp|tif|tiff|svg);base64,([^"]*)"[^>]*>/gi;
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

    const parsedSubject = from + ': ' + (subject || '(No Subject)');
    const parsedText = text || '';
    const parsedHtml = html || '';

    // Parse the attachment-info JSON string
    let parsedAttachmentInfo = {};

    try {
      parsedAttachmentInfo = attachmentInfo ? JSON.parse(attachmentInfo) : {};
    } catch (error) {
      console.error('Error parsing attachmentInfo:', error);
      console.error('attachmentInfo:', attachmentInfo);
      return res.status(400).send('Invalid attachmentInfo format');
    }

    // Create an array of attachments with the required format
    const attachments = req.files.map((file, index) => {
      const contentId = `attachment${index}`;
      const isImage = file.mimetype.startsWith('image/');
      const htmlTag = isImage
        ? `<img src="cid:${contentId}" alt="Embedded image ${index + 1}" />`
        : '';

      const attachmentObject = {
        content: file.buffer.toString('base64'),
        filename: file.originalname,
        type: file.mimetype,
        disposition: isImage ? 'inline' : 'attachment',
        cid: contentId,
        alt: isImage ? `Embedded image ${index + 1}` : undefined,
        htmlTag: htmlTag,
      };

      if (isImage) {
        attachmentObject.content_id = contentId;
      }

      return attachmentObject;
    });

    updatedHtml = processDataUriImages(parsedHtml, attachments);

    const msg = {
      to: process.env.TO_EMAIL,
      from: process.env.FROM_EMAIL,
      replyTo: from,
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
