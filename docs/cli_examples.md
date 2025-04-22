
# typescript
wal_todo -- is a CLI
wal_todo add <wallet-spec> sample_todo.json <path of blob on the platform>
wal_todo share <blob-id or todo-id> <another address>
wal_todo rm <blob-id or todo-id> (deletion , rm *)
wal_todo ls (list all my todos)


# todo operations
** what can I do with a todo **
1. crud operations (create/read/update/delete
2. share it with a contact.
3. mark as complete

# Questions:
+ Who owns the blob - users or our todo-app
+ Storage model :
+ reclaim storage when the todo is deleted.  
+ Handling Sensitive data hiding/masking/encryption 
++ seals protocol for encryption



AWS EXAMPLE 
--- AWS Blob Upload CLI example
--- AUTH : credentials file - where my AUTH keys are stored.
**aws s3 cp sample_todo.json s3://my-bucket-name/folder/sample_todo.json
** aws s3 mv/rm/sync <folder> <remote-folder>
**SYNTAX: aws s3 cp <local-path> <path of blob on the platform>
aws s3 ls (list all my buckets)
aws s3 ls s3:/myvideos (contents of myvideos only)
aws s3 ls s3://myvideos/sports (contents of folder sports, in the bucket myvideos)


