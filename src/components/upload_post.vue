<template>
    <div class="upload_post">
        <button @click="login()">Login</button><br />
        <input v-model="doc_id" /><br />
        <button @click="load_doc()">Load Doc</button><br />
        <input v-model="doc_title" /><br />
        <textarea v-model="doc_content"></textarea><br />
        <textarea v-model="doc_summary"></textarea><br />
        <button @click="upload_doc()">Upload Doc</button><br />
    </div>
</template>

<script>
export default {
    name: "upload_post",
    data() {
        return {
            text_title: "Upload Post",
            doc_id: null,
            doc_title: null,
            doc_content: null,
            doc_summary: null,
        };
    },
    methods: {
        install_firebase() {
            let version = "8.6.0";
            let packages = [
                "firebase-app",
                "firebase-auth",
                "firebase-firestore",
            ];
            packages.forEach((pkg) => {
                let elm = document.createElement("script");
                elm.setAttribute(
                    "src",
                    `https://www.gstatic.com/firebasejs/${version}/${pkg}.js`
                );
                document.head.appendChild(elm);
            });
        },
        init_firebase() {
            // Your web app's Firebase configuration
            var firebaseConfig = {
                apiKey: "AIzaSyC8wr3RkSkKI94MM3_qwDjBfs5mdPAEr7I",
                authDomain: "jacob-blog.firebaseapp.com",
                projectId: "jacob-blog",
                storageBucket: "jacob-blog.appspot.com",
                messagingSenderId: "193060256667",
                appId: "1:193060256667:web:a0db382b878233ae803f3e",
            };
            // Initialize Firebase
            firebase.initializeApp(firebaseConfig);
        },
        login() {
            let self = this;

            var provider = new firebase.auth.GithubAuthProvider();
            provider.setCustomParameters({
                allow_signup: "false",
            });

            firebase
                .auth()
                .signInWithPopup(provider)
                .then((result) => {
                    var credential = result.credential;
                    var token = credential.accessToken;
                    self.user = result.user;
                    console.log(self.user);
                })
                .catch((error) => {
                    var errorCode = error.code;
                    var errorMessage = error.message;
                    var email = error.email;
                    var credential = error.credential;
                    console.log(error);
                });
        },
        load_doc() {
            let self = this;
            var db = firebase.firestore();
            db.collection("POST")
                .doc(self.doc_id)
                .get()
                .then((doc) => {
                    if (doc.exists) {
                        console.log("Document data:", doc.data());
                        let data = doc.data();
                        self.doc_title = data.title;
                        self.doc_content = data.content;
                        self.doc_summary = data.summary;
                    } else {
                        // doc.data() will be undefined in this case
                        console.log("No such document!");
                    }
                })
                .catch((error) => {
                    console.log("Error getting document:", error);
                });
        },
        upload_doc() {
            let self = this;
            var db = firebase.firestore();
            db.collection("POST")
                .doc(self.doc_id)
                .update({
                    title: self.doc_title,
                    content: self.doc_content,
                    summary: self.doc_summary,
                })
                .then(() => {
                    console.log("Document successfully written!");
                })
                .catch((error) => {
                    console.error("Error writing document: ", error);
                });
        },
    },
    mounted: async function () {
        document.title = this.title || this.text_title || document.title || "";
        this.install_firebase();
        await wait(3000);
        this.init_firebase();
    },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.upload_post {
    margin: 48px;
    min-height: 90vh;
}
h1,
h2,
h3,
h4 {
    font-weight: normal;
}

.upload_post > input,
.upload_post > textarea {
    width: 100%;
}
</style>
