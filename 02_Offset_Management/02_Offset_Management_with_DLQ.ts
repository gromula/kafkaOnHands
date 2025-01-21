const { Kafka } = require('kafkajs');

// Kafka configuration
const kafka = new Kafka({
  clientId: 'offset-management-dlq-app',
  brokers: ['localhost:9092'], // Replace with your Kafka brokers
});

// Topics and group details
const mainTopic = 'main-topic';
const deadLetterTopic = 'dead-letter-topic';
const groupId = 'manual-offset-dlq-group';

// Create producer and consumer
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId });

const processMessage = async (message) => {
  // Simulate message processing logic
  console.log(`Processing message: ${message.value?.toString()}`);

  const data = JSON.parse(message.value.toString());
  if (!data.isValid) {
    throw new Error('Invalid message data');
  }

  console.log('Message processed successfully:', data);
};

const sendToDLQ = async (message, error) => {
  try {
    // Send failed message to Dead Letter Queue
    await producer.send({
      topic: deadLetterTopic,
      messages: [
        {
          value: message.value.toString(),
          headers: { error: error.message }, // Include error details in headers
        },
      ],
    });
    console.log(`Message sent to DLQ: ${message.value.toString()}`);
  } catch (dlqError) {
    console.error('Failed to send message to DLQ:', dlqError.message);
  }
};

(async () => {
  await producer.connect();
  await consumer.connect();

  // Subscribe to the main topic
  await consumer.subscribe({ topic: mainTopic, fromBeginning: true });

  console.log(`Consumer subscribed to topic: ${mainTopic}`);

  // Run consumer with manual offset management and DLQ handling
  await consumer.run({
    eachMessage: async ({ topic, partition, message, heartbeat }) => {
      const offset = message.offset;

      try {
        // Attempt to process the message
        await processMessage(message);

        // Manually commit the offset after successful processing
        await consumer.commitOffsets([
          { topic, partition, offset: (parseInt(offset, 10) + 1).toString() },
        ]);
        console.log(`Offset committed for message: ${offset}`);
      } catch (error) {
        console.error(`Error processing message at offset ${offset}:`, error.message);

        // Send the message to DLQ if processing fails
        await sendToDLQ(message, error);

        // Commit the offset to avoid reprocessing the failed message
        await consumer.commitOffsets([
          { topic, partition, offset: (parseInt(offset, 10) + 1).toString() },
        ]);
        console.log(`Offset committed for failed message: ${offset}`);
      }

      // Ensure the consumer heartbeat is sent to avoid session timeout
      await heartbeat();
    },
  });
})();
