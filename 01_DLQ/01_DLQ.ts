import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: ['localhost:9092'], 
});

const mainTopic = 'main-topic';
const deadLetterTopic = 'dead-letter-topic';

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'main-group' });

(async () => {
  await producer.connect();
  await consumer.connect();

  await consumer.subscribe({ topic: mainTopic, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        if (message.value === null) {
          console.error('Received a null message value');
          return;
        }

        console.log(`Received message: ${message.value.toString()}`);

        const data = JSON.parse(message.value.toString());
        if (!data.isValid) {
          throw new Error('Invalid data');
        }

        console.log('Message processed successfully:', data);
      } catch (error) {
        console.error('Error processing message:', error.message);

        if (message.value === null) {
          console.error('Received a null message value');
          return;
        }

        await producer.send({
          topic: deadLetterTopic,
          messages: [
            {
              value: message.value.toString(),
              headers: { error: error.message },
            },
          ],
        });

        console.log('Message sent to Dead Letter Queue:', message.value.toString());
      }
    },
  });
})();
