# Register user
curl -k -d '{"email":"emily@emily.me", "displayName": "Emily", "firstName": "Emily", "lastName": "Lin", "gender": "F", "password":"password","dob":"1998-05-01"}' -H "Content-Type: application/json" -X POST https://localhost:8443/users/register
curl -k -d '{"email":"emily2@emily.me", "displayName": "Emily", "firstName": "Emily", "lastName": "Lin", "gender": "F", "password":"password"}' -H "Content-Type: application/json" -X POST https://localhost:8443/users/register
curl -k -d '{"email":"emily3@emily.me", "displayName": "Emily", "firstName": "Emily", "lastName": "Lin", "gender": "F", "password":"password"}' -H "Content-Type: application/json" -X POST https://localhost:8443/users/register
curl -k -d '{"email":"eric@emily.me", "displayName": "Eric", "firstName": "Eric", "lastName": "Lin", "gender": "M", "password":"password"}' -H "Content-Type: application/json" -X POST https://localhost:8443/users/register
curl -k -d '{"email":"test@emily.me", "displayName": "Test", "firstName": "Test", "lastName": "Ing", "gender": "M", "password":"password"}' -H "Content-Type: application/json" -X POST https://localhost:8443/users/register

# Test login
login1=$(curl -k -d '{"email":"emily@emily.me", "password":"password"}' -H "Content-Type: application/json" -X POST https://localhost:8443/login)
auth1=<whatever the auth token that we got back>

# Test login 2
login2=$(curl -k -d '{"email":"emily2@emily.me", "password":"password"}' -H "Content-Type: application/json" -X POST https://localhost:8443/login)
auth2=<whatever the auth token that we got back>

# Test login 3
login3=$(curl -k -d '{"email":"emily3@emily.me", "password":"password"}' -H "Content-Type: application/json" -X POST https://localhost:8443/login)
auth3=<whatever the auth token that we got back>

# Test update user
curl -k -H "Content-Type: application/json" -d "{\"authToken\":\"${auth1}\",\"id\":1,\"revision\":0,\"email\":\"emily@emily.me\",\"displayName\":\"Emily\",\"firstName\":\"Emily\",\"lastName\":\"Lin\",\"gender\":\"F\",\"password\":\"password\",\"dob\":\"1998-02-01\"}" -H "Content-Type: application/json" -X POST https://localhost:8443/users/update

# Test unregister uer
curl -k -d "{\"authToken\":\"${auth1}\",\"id\":2}" -H "Content-Type: application/json" -X POST https://localhost:8443/users/unregister

# Test Image upload
curl -k -X POST -F "authToken=${auth1}" -F "name=Beautiful nature 1" -F "tags[]=nature" -F "tags[]=mountain" -F "tags[]=fall" -F "image=@image1.jpg" https://localhost:8443/repo/add
curl -k -X POST -F "authToken=${auth1}" -F "name=Beautiful nature 2" -F "tags[]=nature" -F "tags[]=mountain" -F "image=@image1.jpg" https://localhost:8443/repo/add

# Test image update
curl -k -H "Content-Type: application/json" -X POST -d "{\"authToken\":\"${auth1}\",\"id\":1,\"revision\":0,\"ownerId\":1,\"name\":\"Beautiful mountain 1\",\"tags\":[\"nature\",\"mountain\",\"fall\",\"america\"]}" https://localhost:8443/repo/update

# Get image
curl -k -H "Content-Type: application/json" -X POST -d "{\"authToken\":\"${auth1}\",\"id\":1,\"full\":false}" https://localhost:8443/repo/image
curl -k -H "Content-Type: application/json" -X POST -d "{\"authToken\":\"${auth1}\",\"id\":1,\"full\":true}" https://localhost:8443/repo/image

# Search images
curl -k -H "Content-Type: application/json" -X POST -d "{\"authToken\":\"${auth1}\",\"tags\":[\"mountain\",\"nature\"]}" https://localhost:8443/repo/search

# delete image
curl -k -H "Content-Type: application/json" -X POST -d "{\"authToken\":\"${auth1}\",\"id\":6,\"full\":true}" https://localhost:8443/repo/delete