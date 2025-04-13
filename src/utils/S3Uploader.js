const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

exports.uploadFileToS3 = async (file) => {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File size exceeds the 10MB limit");
  }

  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: `${Date.now()}_${file.originalname}`, // Tên file trên S3
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  const uploadResult = await s3.upload(params).promise();
  return {
    url: uploadResult.Location,
    file_type: file.mimetype,
    file_name: file.originalname,
    file_size: file.size,
  };
};
