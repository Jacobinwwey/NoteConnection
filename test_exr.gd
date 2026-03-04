extends SceneTree
func _init():
    var img = Image.new()
    var err = img.load('E:/Knowledge_project/NoteConnection_app/path_mode/assets/backgrounds/belfast_sunset_puresky_4k.exr')
    print('Load ERX result: ', err)
    quit()
