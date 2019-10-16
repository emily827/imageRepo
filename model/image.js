module.exports = class Image {
    id = 0;
    revision = 0;
    name = null;
    rawId = null;
    imageType = null;
    image = null;
    thumbnail = null;
    tags = null;
    time = null;
    location = null;
    info = null;
    ownerId = null;
    ownerName = null;

    static fromJson(json) {
        let img = new Image();
        for (var prop in json) {
            if (img.hasOwnProperty(prop)) {
                img[prop] = json[prop];
            }
        }
        return img;
    }

    toJson() {
        return JSON.stringify(this);
    }
}