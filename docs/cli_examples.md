
wal_todo -- is a CLI
wal_todo <wallet-spec> sample_todo.json <path of blob on the platform>

Questions:

+ Who owns the blob - users or our todo-app
+ Storage model :
+ reclaim storage when the todo is deleted.  
+ Handling Sensitive data hiding/masking/encryption 
++ seals protocol for encryption






AWS EXAMPLE 
--- AWS Blob Upload CLI example
--- AUTH : credentials file - where my AUTH keys are stored.
**aws s3 cp sample_todo.json s3://my-bucket-name/folder/sample_todo.json
**SYNTAX: aws s3 cp <local-path> <path of blob on the platform>
