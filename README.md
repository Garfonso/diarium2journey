# diarium2journey
This converts Diarium HTML Exports into journey.zip for import in Journey

Diarium is a nice Windows 10 UWP App https://timopartl.com/#diarium

Journey is a nice multi plattform diary app.

My issue was that I like to write diary entries on my phone. But I recently migrated away from Windows 10 Mobile. So I wanted to take with me all my precious diary entries to my new home Journey.

## Installation:
* Install node.js (if not already installed)
* Download this repository as zip
* Unzip to a new folder
* Open a shell and go to this folder
* run `npm install` in that folder to download dependencies

## Usage:

In Diarium Export the entries you want to take with you as html file (there is a button in the options to start a bulk export). Be sure to tick "one entry per file" and "create files for media stuff". Select a folder where a lot of subfolders will be created.

Run `node index.js in="EXPORT DIRECTORY FROM ABOVE"`.
All other parameters are optional.
* You can use "lang=ger" to select a different language of input files. Currently only english and german exist. This will only affect the import of tags, persons (converted into tags) and locations.
* You can select another output directory than "current working dir/out" with out="some other output dir". Or another temp dir with temp="some temp dir". The temp dir should be empty though and will be created if not existing.

After the things is run through you will find a journey.zip in the output dir and a temp folder, which you can savely delete.
You can then fire up journey and select the zip file for import. Strangely the name of the zip seems to be critical.

## Know issues and limitations:
* Weather information is not yet supported. Might never be. I only get some localized human readable strings in the export and would need to convert them into computer readable data. Currently that is too much effort. Maybe Diarium will add something to the export that will make it easier.
* Only german language export was tested. Diarium exports the entries into a human readable and localized format. So I need to parse stuff from the html files. The Tags, location and persons can only be identified by their localized description. So if you are missing tags, feel free to open an issue (or better even pullrequest) with your localized labels for tags, person and location.

## Licences:
MIT License. Feel free to do whatever you want to do with it. This is provided as is. I am not responsible if something goes wrong and you loose data or worse.
