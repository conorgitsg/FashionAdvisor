export const environment = {
  production: false,
  apiUrl: 'https://fashionadvisorhack.onrender.com/api',
  s3: {
    region: 'ap-southeast-1',
    bucketName: 'fashion-advisor',
    // Note: AWS credentials should be handled by your backend, not exposed in frontend
    // These are only for reference/documentation purposes
  }
};
