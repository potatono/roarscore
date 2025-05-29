class RSProfiles extends RSObject {
  constructor(rs) {
    super(rs);

    this.profile = van.state(null);
    this.profiles = van.state({});
    this.defaultProfile = null;
  }

  async setup() {
    this.rs.scenes.addEventListener("sceneChanged", (e) => {
      this.onSceneChanged(e.detail.scene);
    });
    this.computeLayout();
    await this.loadDefaultProfile();
    await this.load();
  }

  onSceneChanged(scene) {
    if (scene.defaultProfile && scene.defaultProfile in this.profiles.val) {
      document.getElementById("profile-selector").value = scene.defaultProfile;
      this.changeProfile(scene.defaultProfile);
    }
  }

  changeProfile(profileId) {
    this.profile.val = this.getById(profileId);
    this.dispatchEvent(
      new CustomEvent("profileChanged", {
        detail: { profile: this.profile.val },
      })
    );
  }

  computeLayout() {
    var lo = this.lo || {};

    lo.editorWidth = Math.min(1100, lo.width * 0.75);
    lo.editorHeight = Math.min(610, lo.height - 50);
    lo.editorX = lo.width / 2 - lo.editorWidth / 2;
    lo.editorY = lo.height / 2 - lo.editorHeight / 2;

    lo.listWidth = 600;
    lo.listHeight = 400;
    lo.listX = lo.width / 2 - lo.listWidth / 2;
    lo.listY = lo.height / 2 - lo.listHeight / 2;

    this.lo = lo;
    return lo;
  }

  createSelect(name, value) {
    const { span, select, option } = van.tags;

    return span(() => {
      var options = Object.keys(this.profiles.val).map((key) =>
        option({ value: key }, this.profiles.val[key].name)
      );

      var ele = select({ name: name }, options);
      ele.value = value;
      return ele;
    });
  }

  createSelector() {
    const { span, a, i, label, select, option } = van.tags;

    // Profile selector
    // Enumerates profiles stored this.profiles and if logged in adds a (New Profile) to the `botto`m
    // Note: VanJS requires lists to be wrapped in a dom element so we return the whole select here
    return span(
      // Select element
      span(() => {
        var options = Object.keys(this.profiles.val).map((key) =>
          option({ value: key }, this.profiles.val[key].name)
        );

        return select(
          {
            id: "profile-selector",
            style: "width: 300px",
            onchange: () =>
              this.changeProfile(
                document.getElementById("profile-selector").value
              ),
          },
          options
        );
      }),

      // Actions if logged in
      () => {
        if (this.rs.authState.val) {
          return span(
            a(
              {
                href: "#",
                style: "text-decoration: none; margin-left: 10px; color:black",
                onclick: async () => this.showList(),
              },
              i({ class: "fa-solid fa-gear" })
            )
          );
        } else {
          return span();
        }
      }
    );
  }

  getDefault() {
    return this.defaultProfile;
  }

  async loadDefaultProfile() {
    var response = await fetch("profile.json");
    this.defaultProfile = await response.json();
  }

  async load() {
    const q = this.db.query(this.db.collection(this.db.instance, "profiles"));
    this.unsubscribe = this.db.onSnapshot(q, (snapshot) => {
      var profiles = {};
      snapshot.forEach((doc) => {
        profiles[doc.id] = doc.data();
      });

      this.profiles.val = profiles;

      // If no profile is selected, select the first one
      if (this.profile.val == null && Object.keys(profiles).length) {
        this.changeProfile(Object.keys(profiles)[0]);
      }
    });
  }

  // Gets a profile from the firestore collection "profiles"
  getById(profileId) {
    return this.profiles.val[profileId];
  }

  // Get a profile from the editor form
  getFromEditor(form) {
    var profile = {
      id: form.id.value,
      name: form.Name.value,
      description: form.Description.value,
      emotions: {},
    };

    form.querySelectorAll(".emotions input").forEach((input) => {
      profile.emotions[input.name] = parseFloat(input.value);
    });

    return profile;
  }

  showList() {
    let lo = this.lo;
    const { div, span, table, thead, tbody, tr, th, td, a, button } = van.tags;
    const closed = van.state(false);

    var height = Math.max(
      lo.listHeight,
      110 + (Object.keys(this.profiles.val).length + 1) * 30
    );
    var y = lo.height / 2 - height / 2;

    this.profilesList = FloatingWindow(
      {
        title: "Profiles",
        x: lo.listX,
        y: y,
        width: lo.listWidth,
        height: height,
        childrenContainerStyleOverrides: { padding: 0 },
        closed,
        closeCross: null,
      },
      span(
        {
          class: "vanui-window-cross",
          style: "position: absolute; top: 8px; right: 8px;cursor: pointer;",
          onclick: () => (closed.val = true),
        },
        "\u00D7"
      ),
      div(
        table(
          { class: "list" },
          thead(tr(th("Name"), th("Description"))),
          tbody(
            Object.values(this.profiles.val).map((profile) =>
              tr(
                td(
                  a(
                    {
                      onclick: () => {
                        this.showEditor(profile);
                        this.profilesList.close();
                      },
                    },
                    profile.name
                  )
                ),
                td(profile.description)
              )
            )
          )
        ),
        button(
          {
            class: "list-new-button",
            onclick: () => {
              this.showEditor(this.getDefault());
              this.profilesList.close();
            },
          },
          "New Profile"
        )
      )
    );

    this.profilesList.close = () => {
      closed.val = true;
    };

    van.add(document.body, this.profilesList);
  }

  // Displays a profile editor form inside a FloatingWindow
  showEditor(profile) {
    let lo = this.lo;
    const { div, form, label, input, button, h3, span } = van.tags;
    const closed = van.state(false);

    this.profileEditor = FloatingWindow(
      {
        title: "Edit Profile",
        x: lo.editorX,
        y: lo.editorY,
        width: lo.editorWidth,
        height: lo.editorHeight,
        childrenContainerStyleOverrides: { padding: 0 },
        closed,
        closeCross: null,
      },
      span(
        {
          class: "vanui-window-cross",
          style: "position: absolute; top: 8px; right: 8px;cursor: pointer;",
          onclick: () => (closed.val = true),
        },
        "\u00D7"
      ),
      div(
        form(
          { id: "profile_editor", class: "editor", style: "padding: 20px" },
          input({ type: "hidden", name: "id", value: profile.id || null }),

          div(
            label({ for: "Name" }, "Name"),
            input({
              type: "text",
              name: "Name",
              required: true,
              value: profile.name,
            })
          ),

          div(
            label({ for: "Description" }, "Description"),
            input({
              type: "text",
              name: "Description",
              required: true,
              value: profile.description,
            })
          ),

          h3("Emotions"),

          div(
            { class: "emotions" },
            Object.keys(profile.emotions)
              .sort()
              .map((key) =>
                div(
                  label({ for: key }, key),
                  input({
                    type: "number",
                    min: -2,
                    max: 2,
                    step: 0.25,
                    name: key,
                    required: true,
                    value: profile.emotions[key],
                  })
                )
              )
          ),

          div(
            { class: "footer" },
            button(
              {
                type: "button",
                onclick: () => {
                  var profile = this.getFromEditor(
                    document.getElementById("profile_editor")
                  );
                  this.handleSave(profile).then(() =>
                    this.profileEditor.close()
                  );
                  return false;
                },
              },
              "Save"
            ),

            span(() =>
              profile.id
                ? button(
                    {
                      type: "button",
                      onclick: () => {
                        this.handleDelete(profile).then(() =>
                          this.profileEditor.close()
                        );
                        return false;
                      },
                    },
                    "Delete"
                  )
                : null
            )
          )
        )
      )
    );

    this.profileEditor.close = () => {
      closed.val = true;
    };

    van.add(document.body, this.profileEditor);
  }

  // Save a profile to the firestore collection "profiles"
  async handleSave(profile) {
    try {
      var docRef = profile.id
        ? this.db.doc(this.db.instance, "profiles", profile.id)
        : this.db.doc(this.db.collection(this.db.instance, "profiles"));

      profile.id = docRef.id;
      await this.db.setDoc(docRef, profile);

      // Update the local profiles cache
      var profiles = { ...this.profiles.val };
      profiles[profile.id] = profile;
      this.profiles.val = profiles;

      return profile;
    } catch (e) {
      console.error(e);
    }
  }

  async handleDelete(profile) {
    if (
      !confirm(`Are you sure you want to delete the profile "${profile.name}"?`)
    )
      return;

    try {
      var docRef = this.db.doc(this.db.instance, "profiles", profile.id);
      await this.db.deleteDoc(docRef);

      // Update the local profiles cache
      var profiles = { ...this.profiles.val };
      delete profiles[profile.id];
      this.profiles.val = profiles;
    } catch (e) {
      console.error(e);
    }
  }
}
