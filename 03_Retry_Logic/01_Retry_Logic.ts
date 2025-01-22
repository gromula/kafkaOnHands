const { Kafka, logLevel } = require('kafkajs');

// Kafka configuration with retry settings
const kafka = new Kafka({
  clientId: 'connection-retry-app',
  brokers: ['localhost:9092'], // Replace with your Kafka brokers
  connectionTimeout: 3000, // Timeout for initial connection
  retry: {
    retries: 5, // Number of retry attempts
    initialRetryTime: 300, // Initial wait time (in ms)
    maxRetryTime: 30000, // Max wait time for retries (in ms)
    factor: 2, // Exponential backoff factor
  },
  logLevel: logLevel.ERROR, // Log level for KafkaJS
});

const topic = 'connection-issue-topic';
const groupId = 'retry-group';

// Create producer and consumer
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId });

// Retry logic for message production
const sendMessageWithRetry = async (message) => {
  try {
    await producer.send({
      topic,
      messages: [{ value: message }],
    });
    console.log(`Message sent: ${message}`);
  } catch (error) {
    console.error('Failed to send message after retries:', error.message);
  }
};

(async () => {
  try {
    // Connect producer and consumer with retry logic
    console.log('Connecting producer and consumer...');
    await producer.connect();
    await consumer.connect();
    console.log('Producer and consumer connected');

    // Subscribe to topic
    await consumer.subscribe({ topic, fromBeginning: true });
    console.log(`Subscribed to topic: ${topic}`);

    // Consume messages
    await consumer.run({
      eachMessage: async ({ message }) => {
        console.log(`Received message: ${message.value?.toString()}`);
      },
    });

    // Example: Send a message with retry
    await sendMessageWithRetry('Hello Kafka with retry!');
  } catch (error) {
    console.error('Connection error:', error.message);

    // Retry logic for connection issues
    console.log('Retrying connection in 5 seconds...');
    setTimeout(() => {
      process.exit(1); // Optional: Restart the process for reconnection
    }, 5000);
  }
})();
