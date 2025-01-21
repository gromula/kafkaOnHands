import { Kafka } from 'kafkajs';
// Kafka configuration
const kafka = new Kafka({
  clientId: 'my-app',
  brokers: ['localhost:9092'], // Kafka brokers
});

// Topic names
const mainTopic = 'main-topic';
const deadLetterTopic = 'dead-letter-topic';

// Create a producer and a consumer
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'main-group' });

// Function to process messages
const processMessage = async (message) => {
  // Simulate message processing
  console.log(`Processing message: ${message.value.toString()}`);
  
  const data = JSON.parse(message.value.toString());
  if (!data.isValid) {
    throw new Error('Invalid data'); // Throw an error if the message is invalid
  }

  console.log('Message processed successfully:', data);
};

// Function to handle Dead Letter Queue
const sendToDLQ = async (message, error) => {
  try {
    await producer.send({
      topic: deadLetterTopic,
      messages: [
        {
          value: message.value.toString(),
          headers: { error: error.message }, // Include error details in headers
        },
      ],
    });
    console.log('Message sent to DLQ:', message.value.toString());
  } catch (dlqError) {
    console.error('Error sending message to DLQ:', dlqError.message);
  }
};

(async () => {
  // Connect the producer and consumer
  await producer.connect();
  await consumer.connect();

  // Subscribe to the main topic
  await consumer.subscribe({ topic: mainTopic, fromBeginning: true });

  // Handle messages from the main topic
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        await processMessage(message); // Attempt to process the message
      } catch (error) {
        console.error('Error processing message:', error.message);

        // Asynchronously send the message to DLQ if processing fails
        await sendToDLQ(message, error);
      } finally {
        // Offset is automatically committed by KafkaJS after processing
        console.log(`Offset for message in topic ${topic} has been moved`);
      }
    },
  });
})();
