require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { simpleParser } = require('mailparser');
const sgMail = require('@sendgrid/mail');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

const rawPayloadStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const rawPayloadUpload = multer({
  storage: rawPayloadStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // Set the size limit for individual files to 50 MB
    fieldSize: 1 * 1024 * 1024, // Set the size limit for non-file fields combined to 1 MB
  },
}).single('email');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Extract and process data URI images
function processDataUriImages(html, attachments) {
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
  console.log('req.body', req.body);

  try {
    let rawEmail, parsedEmail;

    if (req.file) {
      rawEmail = fs.readFileSync(req.file.path, 'utf-8');
      console.log('Raw email:', rawEmail);
      parsedEmail = await simpleParser(rawEmail);
      console.log('Parsed email:', parsedEmail);
    } else {
      parsedEmail = {
        from: { value: [{ address: req.body.from, name: '' }] },
        subject: req.body.subject,
        text: req.body.text,
        html: req.body.html,
        attachments: [],
      };
    }

    const { from, subject, text, html, attachments } = parsedEmail;

    if (!from) {
      return res.status(400).send('Missing required field: from');
    }

    const parsedSubject =
      from.value[0].address + ': ' + (subject || '(No Subject)');
    const parsedText = text || '';
    const parsedHtml = html ? processDataUriImages(html, attachments) : '';

    const msg = {
      to: process.env.TO_EMAIL,
      from: process.env.FROM_EMAIL,
      replyTo: from.value[0].address,
      subject: parsedSubject,
      text: parsedText,
      html: parsedHtml,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    console.log('Sending message:', msg);

    await sgMail.send(msg);

    if (req.file) {
      // After processing the file, delete it from the server
      fs.unlink(req.file.path, (err) => {
        if (err) {
          console.error('Error while deleting the file:', err);
          res.status(500).send('Error while deleting the file');
        } else {
          console.log('File deleted successfully');
          res.status(200).send('File processed and deleted');
        }
      });
    } else {
      // If no file was uploaded, just send a success response
      res.status(200).send('Email processed successfully');
    }
  } catch (error) {
    console.error('Error processing the file:', error);
    res.status(500).send('Error processing the file');

    // If an error occurred and the file was uploaded, delete it
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) {
          console.error('Error while deleting the file:', err);
        } else {
          console.log('File deleted after error');
        }
      });
    }
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
