# cognito-local, with codes delivered instead of only printed: emails go to Mailpit, text
# messages to LocalStack SNS (deliver.cjs). Its own encrypted-sender hook crashes in this
# release, so the delivery is added where it prints the code.
FROM jagregory/cognito-local:5.3.0
COPY deliver.cjs patch.cjs /app/
RUN node /app/patch.cjs && rm /app/patch.cjs
