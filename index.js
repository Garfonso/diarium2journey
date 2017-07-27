/**
 * Created by achim on 27.07.2017.
 */
/*jslint node: true, es6: true, white: true */
/*jshint esversion: 6 */

"use strict";

const fs = require("fs");
const path = require("path");
const NodePromise = require("promise");
const zipper = require("zip-local");

//html processing:
const striptags = require("striptags");
const he = require("he");

const readDirPromise = NodePromise.denodeify(fs.readdir);
const writeFilePromise = NodePromise.denodeify(fs.writeFile);
const readFilePromise = NodePromise.denodeify(fs.readFile);
const mkdirPromise = NodePromise.denodeify(fs.mkdir);
const zipPromise = NodePromise.denodeify(zipper.zip);

//parameters, can also be set by "name=value" in command line.
let language = "eng";
let outDir = path.resolve(".", "out");
let tempDir = path.resolve(outDir, "tmp"); //should be empty. Will be created if does not exist.
let inDir = path.resolve(".");
let enableDebugging = true;

const languages = {
    eng: {
        locationString: "Location",
        tagString: "Tags",
        peopleString: "People"
    },
    ger: {
        locationString: "Ort",
        tagString: "Tags",
        peopleString: "Personen"
    }
};

function debug(...msgs) {
    if (enableDebugging) {
        console.log(...msgs);
    }
}

function copyFile(source, target) {
    return new NodePromise(function(resolve, reject) {
        let wr;
        const rd = fs.createReadStream(source);
        function rejectCleanup(err) {
            rd.destroy();
            if (wr) {
                wr.end();
            }
            reject(err);
        }
        rd.on("error", rejectCleanup);
        rd.on("open", function () {
            wr = fs.createWriteStream(target);
            wr.on("error", rejectCleanup);
            wr.on("finish", function (err, res) {
                if (err) {
                    rejectCleanup(err);
                } else {
                    resolve(res);
                }
            });
            rd.pipe(wr);
        });
    });
}

//concatenate all Header and Content paragraphs.
function processParagraphs(cd, entry) {
    let ps = cd.split("</p>");
    entry.text = "";
    ps.forEach(function handleParagraph(p) {
        let v = p.substring(p.indexOf(">") + 1);
        if (p.indexOf("class=\"Content\"") >= 0) {
            entry.text += v + "\n";
        } else if (p.indexOf("class=\"Header\"") >= 0) {
            entry.text += "#" + v + "\n\n";
        } else if(p.indexOf("class=\"TagsLocation\"") >= 0) {
            //TagsLocation can be: Tags, Location, Weather or Person.
            if (v.indexOf(languages[language].locationString + ":") === 0) {
                //have: Ort: 99.734, 9.0946 -> extract lat + lon
                entry.lat = v.substring(v.indexOf(" " + 1, v.indexOf(",")));
                entry.lon = v.substring(v.lastIndexOf(" ") + 1);
            } else if (v.indexOf(languages[language].tagString + ":") === 0) {
                //have Tags: Tag1, Tag2, Tag3
                let ts = v.substring(v.indexOf(" ") + 1);
                entry.tags = entry.tags.concat(ts.split(", "));
            } else if (v.indexOf(languages[language].peopleString + ":") === 0) {
                //have Personen: TestName TestLastname, Name1 Lastname1, Name2 Lastname2
                //create tag for each person.
                let persons = v.substring(v.indexOf(" ") + 1).split(", ");
                persons.forEach(function processPerson(person) {
                    entry.tags.push(person.trim().replace(/\s/g, "_"));
                });
            }
            //can not yet process weather. Seems quite complex.
        }
    });

    entry.preview_text = entry.text.substring(0, 512);
}

//create journey entry from html file:
function createEntry(folder, file) {
    let promise = readFilePromise(path.resolve(inDir, folder, file), "utf8");

    promise = promise.then(function processFileContents(data) {
        let cd = he.decode(striptags(data, ["p"]));
        //debug("Result text: ", cd);
        let ts = new Date(folder).getTime();
        let result = {
            "text": "",
            "date_modified": ts,
            "date_journal": ts,
            "id": ts + "-diarium",
            "preview_text": "",
            "address": "",
            "music_artist": "",
            "music_title": "",
            "lat": null,
            "lon": null,
            "mood": 0,
            "weather": { //TODO: Weather might be in html. How to properly parse it?
                "id": 701,
                "degree_c": null,
                "description": "",
                "icon": "",
                "place": ""
            },
            "photos": [],
            "tags": []
        };
        processParagraphs(cd, result);
        return result;
    });

    return promise;
}

//processes one folder = one day = one entry into one json file:
function processFolder(folder) {
    let promise = readDirPromise(path.resolve(inDir, folder));
    let photos = [];
    let entry = {};

    promise = promise.then(function processContents(contents) {
        let entryFile;
        contents.forEach(function processFile(f) {
            if (path.extname(f) === ".html") {
                //html file!
                entryFile = f;
            } else {
                photos.push(f);
            }
        });
        if (!entryFile) {
            throw "No entry file in folder " + folder + ". Did you export as html?";
        }

        return createEntry(folder, entryFile);
    });

    promise = promise.then(function addPhotos(newEntry) {
        entry = newEntry;
        entry.photos = photos.map((photo) => entry.id + "-" + photo);
        return entry;
    });

    promise = promise.then(function storeEntry() {
        return writeFilePromise(path.resolve(tempDir, entry.id + ".json"), JSON.stringify(entry), "utf8");
    });

    promise = promise.then(function handlePhotos() {
        function copyPhoto(p, index) {
            //debug("Copying from " + inDir + "\\" + folder + "\\" + p + " to " + tempDir + "\\" + entry.photos[index] + " for ", entry);
            return copyFile(path.resolve(inDir, folder, p), path.resolve(tempDir, entry.photos[index]));
        }
        return NodePromise.all(photos.map(copyPhoto));
    });

    return promise;
}


//read parameters:
process.argv.forEach(function processParam(p) {
    if (p.indexOf("=") >= 0) {
        let [key, value] = p.split("=");
        switch (key) {
            case "language":
            case "lang":
            case "lng":
                language = value;
                break;
            case "outDir":
            case "out":
                outDir = value;
                break;
            case "tempDir":
            case "tmpDir":
            case "temp":
            case "tmp":
                tempDir = value;
                break;
            case "inDir":
            case "in":
                inDir = value;
                break;
            case "enableDebugging":
                enableDebugging = value.toLocaleLowerCase() !== "false" && value !== "0";
                break;
            default:
                console.log("Unsupported parameter " + key);
        }
    }
});

console.log("Reading export from " + inDir + "\nWriting to " + outDir + "\nUsing temporary dir " + tempDir + "\nUsing language " + language);

let promise = mkdirPromise(outDir);

promise = promise.then(function () {
    return mkdirPromise(tempDir);
}, function (err) {
    if (err.code === "EEXIST") { //already exists. All fine.
        return mkdirPromise(tempDir);
    }
    throw err;
});

promise = promise.then(function () {
    return readDirPromise(inDir);
}, function (err) {
    if (err.code === "EEXIST") { //already exists. All fine.
        return readDirPromise(inDir);
    }
    throw err;
});

//process direcory contents. Should have one folder for each day:
promise = promise.then(function processInDir(folders) {
    return NodePromise.all(folders.map(processFolder));
});

promise = promise.then(function zipStuff() {
    return zipPromise(tempDir);
});

promise = promise.then(function storeZipFile(zipped) {
    zipped.compress();
    return writeFilePromise(path.resolve(outDir, "journey.zip"), zipped.memory());
});

promise = promise.then(function (result) {
    debug("Result: ", result);
    console.log("All done successfully. Zip is in " + outDir + ". Pleaes clear temp directory " + tempDir + " yourself.");
}, function (error) {
    console.log("Had error: ", error);
});
