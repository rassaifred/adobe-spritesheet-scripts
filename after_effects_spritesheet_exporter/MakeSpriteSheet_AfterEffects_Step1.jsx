﻿/**
 * MakeSpriteSheet_AfterEffects_Step1.jsx
 * 
 * Intended for UDK/UE3 content creators, this script enables the user to export an After Effects composition
 * to a grid-like sprite sheet. The user is also given the option of automatically resizing and saving 
 * the sprite sheet in multiple different sizes/resolutions.
 *
 * @author Rohan Liston
 * @version 1.0
 * @date 14-Feb-2012
 *
 * Feel free to distribute and mangle this script as you like, but please give credit where it is due. 
 * If you find a bug or come up with any cool new features, drop me a line at http://www.rohanliston.com !
 */

#script "Make Sprite Sheet"
#target aftereffects

var photoshopScriptPath = Folder.myDocuments.absoluteURI.toString() + "/Adobe Scripts/MakeSpriteSheet_AfterEffects_Step2.jsx";   // Path to the Photoshop script that takes over (should be in My Documents)
var outputFilePath = Folder.myDocuments.absoluteURI.toString() + "/Adobe Scripts/MakeSpriteSheet_AfterEffects.ini";               // Where the output .ini file will be saved (by default, this is in the same folder as the script)

app.TimecodeDisplayType = TimecodeDisplayType.FRAMES;           // We will use Frames as our units
var acceptableSheetSizes = [2048, 1024, 512, 256, 128, 64];     // List of acceptable square sheet sizes (in pixels)
var exportFolderName = "FrameExports";                          // Name of the folder to which individual frames will be rendered 
var projectName;                                                // Name of the After Effects project
var projectFolder;                                              // Path of the After Effects project
var comp;                                                       // The composition we are rendering
var workAreaDuration;                                           // The duration of the composition's active work area
var renderFile;                                                 // The actual file object for rendered frames
var renderFolderString;                                         // The path of the unique folder generated by createRenderFolder()
var renderNum = 1;                                              // The current render number for this project. Used in createRenderFolder() to generate a unique export folder 
var numCols = 4, numRows = 4;                                   // Number of columns and rows in the sprite sheet
var sheetSizes = [2048, 1024];                                  // Which sheet sizes we would like to autosave
var fileFormat = "PNG";                                         // Which file format we wish to use (PNG/TGA)
var bitDepth = "32";                                            // 32 or 24 bit exporting (TGA only)
var autoSave = true;                                            // Whether we want to resize and save the sprite sheet automatically
var userCancelled = false;                                      // Flag set by showDialog() when the user cancels - exceptions don't work in this case
var sheetFilename;                                              // Sheet name entered by the user in showDialog()

/**
 * Extension of Array prototype - Array.contains(obj)
 */
Array.prototype.contains = function(obj) 
{
    var i = this.length;
    while(i--) 
    {
        if(this[i] == obj)
            return true;
    }
    return false;
}

app.activate();
main();

/**
 * Main function
 */
function main()
{
    // Make sure the After Effects project exists and has been saved
    if(app.project.file != null)
    {
        projectName = app.project.file.displayName.split(".aep")[0];
        sheetFilename = "T_" + projectName;
        projectFolder = app.project.file.parent.absoluteURI.toString();
    }
    else
    {
        alert("Please open a project or save your current project first.");
            return;
    }
    
    // Make sure the After Effects composition exists and is selected
    comp = app.project.activeItem;
    
    if(comp != null && comp instanceof CompItem)
    {   
        try
        {            
            workAreaDuration = comp.workAreaDuration * comp.frameRate;
            
            // Prompt the user for sheet settings
            getValidSettings();
            
            // Render the sheet to individual frames
            render();
            
            // Write the output file that tells Photoshop where to find everything
            writeOutputFile();
            
            // Photoshop takes over from here       
            var psScript = new File(photoshopScriptPath);
            if(psScript.exists)
            {
                psScript.execute();
            }
            else
                alert("Unable to locate Photoshop script " + photoshopScriptPath);
        }
        catch(e)
        {
            if(e.toString() != "exit")
                alert(e.toString());
        }
    }
    else
    {
        alert("Please select the composition you would like to render first.");
    }
}

/**
 * Continually shows the user settings dialog until the user has input valid data or cancelled.
 */
function getValidSettings()
{
    // Show the sprite sheet settings dialog
    showDialog();
    if(userCancelled)
        throw "exit";
    
    if(!validateSheet())
        getValidSettings();
}

/**
 * Checks whether the resulting sheet will be square and a power of two (eg. 1024x1024)
 */
function validateSheet()
{
    var finalWidth = numCols * comp.width;
    var finalHeight = numRows * comp.height;
    var squareSheet = finalWidth == finalHeight;
    var powerOfTwo = acceptableSheetSizes.contains(Math.sqrt(finalWidth * finalHeight));
    
    // Make sure the sheet has an appropriate name
    if(sheetFilename == "")
    {
        alert("Please give the sprite sheet an acceptable name.");
        return false;
    }

    // Make sure the work area duration matches the number of frames in the sheet
    if(numCols*numRows != workAreaDuration)
    {
        alert("The number of frames in the work area (" + trimLeadingZeros(workAreaDuration.toString()) + ") does not match the number of frames in the desired sprite sheet (" + numCols*numRows + ").");
        return false;
    }

    // Only warn if not square AND not a power of two - if it's square we can just resize it
    if(!squareSheet && !powerOfTwo)
    {
        if(!confirm("WARNING: Resulting sheet size will be " + finalWidth + "x" + finalHeight + ", which is not optimal for UE3/UDK. If you proceed, your sprite sheet will not be auto-saved. Proceed?"))
            throw "exit";
        else 
            autoSave = false;
    }

    return true;
}

/**
 * Renders the composition to an image sequence
 */
function render()
{
    var queue = app.project.renderQueue;
    
    // Add the composition to the render queue and set up preferences/paths
    createRenderFolder();

    // Render away!
    var renderItem = queue.items.add(comp);   
    renderFile = new File(renderFolderString + "/" + projectName + "[#####].psd");
    renderItem.outputModules[1].file = renderFile;
    renderItem.outputModules[1].applyTemplate("Photoshop");
    queue.render();
}

/**
 * Writes information to an output file for Photoshop to pick up
 */
function writeOutputFile()
{
    // Save the path to the files we just exported so that the Photoshop script knows where to find them
    var pathFile = new File(outputFilePath);
    
    pathFile.open("w");                       // Super-duper output file format:
    pathFile.writeln(sheetFilename);          // Line 1: Sheet filename that was entered by the user
    pathFile.writeln(projectFolder);          // Line 2: AE project folder
    pathFile.writeln(numCols);                // Line 3: Number of cols 
    pathFile.writeln(numRows);                // Line 4: Number of rows 
    pathFile.writeln(comp.width);             // Line 5: Frame width
    pathFile.writeln(comp.height);            // Line 6: Frame height
    pathFile.writeln(autoSave);               // Line 7: Whether or not to autosave after generating sprite sheet in Photoshop
    pathFile.writeln(sheetSizes);             // Line 8: Output file sizes
    pathFile.writeln(fileFormat);             // Line 9: Output file format
    pathFile.writeln(bitDepth);               // Line 10: Output file bit depth
    
    for(var i=0; i<workAreaDuration; i++)     // Line 11+: File system location of each sub-image in the sequence
    {
        var iStr = pad(i, 5);
        var fileStr = renderFile.absoluteURI.toString();
        pathFile.writeln(fileStr.substr(0, fileStr.length - 15) + iStr + ".psd");
    }

    pathFile.close();
}

/**
 * Creates a folder for the image sequence under "../FrameExports/<PROJECT_NAME>/<RENDER_NUM>. 
 * Recursively searches for a unique folder name.
 */
function createRenderFolder()
{   
    renderFolderString = app.project.file.parent.toString() + "/" + exportFolderName + "/" + projectName + "/" + pad(renderNum,3);
    var newFolder = new Folder(renderFolderString);
    
    if(!newFolder.exists)
    {
        if(!newFolder.create())
            throw Error("Could not create output folder. Make sure \"Allow Scripts to Write Files and Access Network\" is enabled under Edit->Preferences->General.");
    }
    else
    {
        renderNum++;
        createRenderFolder();
    }
}

/**
 * Pad a number with leading zeros
 * @param number - the number to pad
 * @param length - the desired length of the number string after padding
 * @return - a string representing the padded number
 */
function pad(number, length) 
{ 
    var str = '' + number;
    
    while (str.length < length) 
        str = '0' + str;
   
    return str;
}

/**
 * Trim leading zeros from a number string
 * @param str - the number string to trim
 * @return - a string without leading zeros
 */
function trimLeadingZeros(str)
{    
    return str.replace(/^[0]+/g,"");
}

/**
 * Shows a dialog box with various sprite sheet options for the user to select
 */
function showDialog()
{
    var dialog = new Window("dialog {text:'Make Sprite Sheet', alignChildren:['fill','center']}");
    
    var filenameOptions = dialog.add("panel {text:'Sheet Name', alignChildren:'left', orientation:'row', margins:[15,15,15,15]}");
    var filenameGroup = filenameOptions.add("group {alignChildren:'left', orientation:'row'}");
    var filenameLabel = filenameGroup.add("statictext {text:'Name:'}");    
    var filenameText = filenameGroup.add("edittext {text:'" + sheetFilename + "', characters:20}");
    
    var sheetOptions = dialog.add("panel {text:'Sprite Sheet Options', alignChildren:'left', orientation:'row', margins:[15,15,15,15]}");
    
    var rowsColsGroup = sheetOptions.add("group {alignChildren:'left', orientation:'column'}");
    
    var colsGroup = rowsColsGroup.add("group");
    var numColsText = colsGroup.add("edittext {text:'" + numCols + "', characters:3}");
    var numColsLabel = colsGroup.add("statictext {text:'Columns'}");

    var rowsGroup = rowsColsGroup.add("group");
    var numRowsText = rowsGroup.add("edittext {text:'" + numRows + "', characters:3, enabled:" + (numCols == numRows ? "false" : "true") + "}");
    var numRowsLabel = rowsGroup.add("statictext {text:'Rows', enabled:" + (numCols == numRows ? "false" : "true") + "}");
    
    var separator1 = sheetOptions.add("panel {alignment:['center','fill']}");
    var equalRowsGroup = sheetOptions.add("group");
    var equalRowsBox = equalRowsGroup.add("checkbox {text:'Rows = Cols', value:" + (numCols == numRows ? "true" : "false") + "}");
    
    var fileOptions = dialog.add("panel {text:'File Save Options', margins:[15,15,15,15]}");
    var autoSaveBox = fileOptions.add("checkbox {text:'Automatically save output files', value:" + autoSave.toString() + ", orientation:'row'}");
    var fileOptionsInner = fileOptions.add("group {orientation:'row', spacing:25}");
    var resOptions = fileOptionsInner.add("group {orientation:'column'}");
    var formatOptions = fileOptionsInner.add("group {orientation:'column'}");

    var group2048 = resOptions.add("group");
    var label2048 = group2048.add("statictext {text:'2048x2048', characters:9, justify:'right', name:'2048'}");
    var box2048 = group2048.add("checkbox {value:" + sheetSizes.contains(2048) + "}");
    
    var group1024 = resOptions.add("group");
    var label1024 = group1024.add("statictext {text:'1024x1024', characters:9, justify:'right', name:'1024'}");
    var box1024 = group1024.add("checkbox {value:" + sheetSizes.contains(1024) + "}");
    
    var group512 = resOptions.add("group");
    var label512 = group512.add("statictext {text:'512x512', characters:9, justify:'right', name:'512'}");
    var box512 = group512.add("checkbox {value:" + sheetSizes.contains(512) + "}");
    
    var group256 = resOptions.add("group");
    var label256 = group256.add("statictext {text:'256x256', characters:9, justify:'right', name:'256'}");
    var box256 = group256.add("checkbox {value:" + sheetSizes.contains(256) + "}");
    
    var group128 = resOptions.add("group");
    var label128 = group128.add("statictext {text:'128x128', characters:9, justify:'right', name:'128'}");
    var box128 = group128.add("checkbox {value:" + sheetSizes.contains(128) + "}");
    
    var group64 = resOptions.add("group");
    var label64 = group64.add("statictext {text:'64x64', characters:9, justify:'right', name:'64'}");
    var box64 = group64.add("checkbox {value:" + sheetSizes.contains(64) + "}");
    
    var formatMenu = formatOptions.add("dropdownlist {title:'Format:', characters:9, justify:'right'}");
    formatMenu.add("item","PNG");
    formatMenu.add("item","TGA");
    formatMenu.selection = fileFormat == "PNG" ? formatMenu.items[0] : formatMenu.items[1];
    
    var radio24Bit = formatOptions.add("radiobutton {text:'24-bit', enabled:" + (fileFormat == "PNG" ? "false" : "true") + ", value:" + (bitDepth == "24" ? "true" : "false") + "}");
    var radio32Bit = formatOptions.add("radiobutton {text:'32-bit', value:" + (bitDepth == "32" ? "true" : "false") + "}");
    fileOptionsInner.enabled = autoSave;
    
    var buttonGroup = dialog.add("group {alignChildren:['fill','center']}");
    var OKButton = buttonGroup.add("button", undefined, "OK");
    var cancelButton = buttonGroup.add("button", undefined, "Cancel");

    // Make the number of rows match the number of columns if necessary
	numColsText.onChanging = function()
	{
		if(equalRowsBox.value == true)
			numRowsText.text = numColsText.text; 
	}

	// When the checkbox is clicked, enable/disable the second input box
	equalRowsBox.onClick = function()
	{
		numRowsLabel.enabled = !numRowsLabel.enabled; 
		numRowsText.enabled = !numRowsText.enabled; 
		
		if(equalRowsBox.value == true)
			numRowsText.text = numColsText.text;
	}

    // When the autosave checkbox is clicked, enable/disable the file save options
    autoSaveBox.onClick = function()
    {
        fileOptionsInner.enabled = autoSaveBox.value;
    }

    // Event handler for OK button - writes info to variables to be saved in writeOutputFile()
	OKButton.onClick = function()
	{
        var index = 0;
        sheetFilename = filenameText.text.toString();
		numCols = parseInt(numColsText.text);
		numRows = parseInt(numRowsText.text);
         
         sheetSizes = new Array();
         // Read the sheet size checkboxes and add the active ones to the sheetSizes array
         for(i=0; i < resOptions.children.length; i++)
         {
             if(resOptions.children[i].children[1].value == true)
             {
                sheetSizes[index] = resOptions.children[i].children[0].name;
                index++;
             }
         }
         
         autoSave = (autoSaveBox.value == true && sheetSizes.length > 0);
        
         fileFormat = formatMenu.selection.toString();
         bitDepth = radio32Bit.value == true ? "32" : "24";

	    dialog.close();
	}

	// Event handler for Cancel button
	cancelButton.onClick = function()
    {
        userCancelled = true;
        dialog.close();
    }

    // Event handler for changing formats drop-down
    formatMenu.onChange = function()
    {
        if(formatMenu.selection.toString() == "PNG")
        {
            radio24Bit.value = false;
            radio32Bit.value = true;
            radio24Bit.enabled = false;
        }
        else if(formatMenu.selection.toString() == "TGA")
        {
            radio24Bit.enabled = true;
        }
    }

    dialog.center();
    dialog.show();
}